import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import FeatureFlagsService from 'ember-feature-flags/services/feature-flags';
import type {
  AdapterRegistry,
  FeatureFlagsConfig,
} from 'ember-feature-flags/services/feature-flags';
import type { DriftAggregate } from 'ember-feature-flags/drift-reporter';
import FakeAdapter from '../../helpers/fake-adapter.ts';

class SecondaryAdapter extends FakeAdapter {}

const registry: AdapterRegistry = {
  primary: () => Promise.resolve(FakeAdapter),
  secondary: () => Promise.resolve(SecondaryAdapter),
};

interface DriftSetup {
  service: FeatureFlagsService;
  batches: DriftAggregate[][];
}

async function setupDrift(
  primaryFlags: Record<string, unknown>,
  secondaryFlags: Record<string, unknown>,
  driftConfig: FeatureFlagsConfig['drift'] = {},
): Promise<DriftSetup> {
  const service = new FeatureFlagsService();
  const batches: DriftAggregate[][] = [];

  await service.initialize(
    {
      primary: 'primary',
      secondaries: ['secondary'],
      providers: {
        primary: { flags: primaryFlags },
        secondary: { flags: secondaryFlags },
      },
      drift: driftConfig,
    },
    registry,
    { onDrift: (aggregates) => void batches.push(aggregates) },
  );

  return { service, batches };
}

module('Unit | Service | feature-flags | drift', function (hooks) {
  setupTest(hooks);

  test('agreement produces no drift', async function (assert) {
    const { service, batches } = await setupDrift({ a: 1 }, { a: 1 });

    service.variation('a');
    service.flushDrift();

    assert.strictEqual(batches.length, 0, 'nothing reported');
  });

  test('differing values report value_drift with both values', async function (assert) {
    const { service, batches } = await setupDrift({ a: 'x' }, { a: 'y' });

    service.variation('a');
    service.flushDrift();

    const aggregate = batches[0]?.[0] as DriftAggregate;
    assert.strictEqual(aggregate.kind, 'value_drift');
    assert.strictEqual(aggregate.primary.value, 'x', 'primary value captured');
    assert.deepEqual(
      aggregate.secondaries['secondary'],
      { kind: 'value_drift', value: 'y' },
      'secondary value captured',
    );
  });

  test('a flag missing from the secondary is JSON-serializable', async function (assert) {
    const { service, batches } = await setupDrift({ a: true }, {});

    service.variation('a');
    service.flushDrift();

    const aggregate = batches[0]?.[0] as DriftAggregate;
    assert.strictEqual(aggregate.kind, 'missing_in_secondary');

    // A sentinel Symbol here would vanish from any JSON payload, silently
    // emptying `secondaries` for every reporter that serializes.
    const roundTripped = JSON.parse(
      JSON.stringify(aggregate),
    ) as DriftAggregate;
    assert.deepEqual(
      roundTripped.secondaries['secondary'],
      { kind: 'missing_in_secondary', missing: true },
      'survives JSON.stringify intact',
    );
  });

  test('a flag missing from the primary is reported', async function (assert) {
    const { service, batches } = await setupDrift({}, { a: true });

    service.variation('a');
    service.flushDrift();

    assert.strictEqual(batches[0]?.[0]?.kind, 'missing_in_primary');
  });

  test('repeat drift on one flag aggregates rather than duplicating', async function (assert) {
    const { service, batches } = await setupDrift({ a: 1 }, { a: 2 });

    service.variation('a');
    service.variation('a');
    service.variation('a');
    service.flushDrift();

    assert.strictEqual(batches[0]?.length, 1, 'one aggregate');
    assert.strictEqual(batches[0]?.[0]?.count, 3, 'count accumulated');
  });

  test('structurally equal object values are not drift', async function (assert) {
    const { service, batches } = await setupDrift(
      { a: { x: 1, y: [1, 2] } },
      { a: { y: [1, 2], x: 1 } },
    );

    service.variation('a');
    service.flushDrift();

    // `!==` compares objects by reference, so two providers returning
    // structurally identical JSON would report drift on every read.
    assert.strictEqual(
      batches.length,
      0,
      'deep-equal values compare equal regardless of key order',
    );
  });

  test('structurally different object values are drift', async function (assert) {
    const { service, batches } = await setupDrift(
      { a: { x: 1 } },
      { a: { x: 2 } },
    );

    service.variation('a');
    service.flushDrift();

    assert.strictEqual(batches[0]?.[0]?.kind, 'value_drift');
  });

  test('array order is significant', async function (assert) {
    const { service, batches } = await setupDrift(
      { a: ['x', 'y'] },
      { a: ['y', 'x'] },
    );

    service.variation('a');
    service.flushDrift();

    assert.strictEqual(
      batches[0]?.[0]?.kind,
      'value_drift',
      'reordered arrays are genuinely different flag values',
    );
  });

  test('drift.enabled false stops accumulation, not just flushing', async function (assert) {
    const { service, batches } = await setupDrift(
      { a: 1 },
      { a: 2 },
      { enabled: false },
    );

    for (let i = 0; i < 50; i++) service.variation('a');
    service.flushDrift();

    // Gating only the flush timer leaves aggregates accumulating on every
    // read with nothing ever draining them.
    assert.strictEqual(batches.length, 0, 'no aggregates accumulate');
  });

  test('flushing twice does not re-report the same batch', async function (assert) {
    const { service, batches } = await setupDrift({ a: 1 }, { a: 2 });

    service.variation('a');
    service.flushDrift();
    service.flushDrift();

    assert.strictEqual(batches.length, 1, 'buffer is drained on flush');
  });

  test('a throwing onDrift callback does not break the service', async function (assert) {
    const service = new FeatureFlagsService();

    await service.initialize(
      {
        primary: 'primary',
        secondaries: ['secondary'],
        providers: {
          primary: { flags: { a: 1 } },
          secondary: { flags: { a: 2 } },
        },
      },
      registry,
      {
        onDrift: () => {
          throw new Error('reporter exploded');
        },
      },
    );

    service.variation('a');
    service.flushDrift();

    assert.strictEqual(service.variation('a'), 1, 'service still reads flags');
  });

  test('a secondary that throws on read is quarantined', async function (assert) {
    const service = new FeatureFlagsService();
    const batches: DriftAggregate[][] = [];

    await service.initialize(
      {
        primary: 'primary',
        secondaries: ['secondary'],
        providers: {
          primary: { flags: { a: 1 } },
          secondary: { failRead: true },
        },
      },
      registry,
      { onDrift: (aggregates) => void batches.push(aggregates) },
    );

    service.variation('a');
    service.flushDrift();

    assert.strictEqual(
      batches.length,
      0,
      'no drift recorded for a failed read',
    );
    assert.strictEqual(service.variation('a'), 1, 'primary still readable');
  });

  module('attributes', function () {
    test('allowlisted identity attributes are attached', async function (assert) {
      const service = new FeatureFlagsService();
      const batches: DriftAggregate[][] = [];

      await service.initialize(
        {
          primary: 'primary',
          secondaries: ['secondary'],
          providers: {
            primary: { flags: { a: 1 } },
            secondary: { flags: { a: 2 } },
          },
          drift: { includeAttributes: ['organization_id'] },
        },
        registry,
        { onDrift: (aggregates) => void batches.push(aggregates) },
      );

      await service.identify(
        { id: 'user-1', email: 'nope@example.com' },
        { organization_id: 'org-9', project_id: 'proj-3' },
      );

      service.variation('a');
      service.flushDrift();

      assert.deepEqual(
        batches[0]?.[0]?.attributes,
        { organization_id: 'org-9' },
        'only the allowlisted attribute is included',
      );
    });

    test('attributes default to empty when nothing is allowlisted', async function (assert) {
      const { service, batches } = await setupDrift({ a: 1 }, { a: 2 });

      await service.identify({ id: 'user-1' }, { organization_id: 'org-9' });
      service.variation('a');
      service.flushDrift();

      assert.deepEqual(
        batches[0]?.[0]?.attributes,
        {},
        'no attributes leak without an explicit allowlist',
      );
    });
  });
});
