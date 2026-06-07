import {mapRequisitionStatus} from '../requisition-status.js';

describe('mapRequisitionStatus', () => {
  // ------------------------------------------------------------------ pending
  it.each(['CR', 'GC', 'UA', 'SA', 'GA'])(
    'maps %s (pending/auth-in-progress) to status=pending, renewable=false',
    (status) => {
      const result = mapRequisitionStatus(status);
      expect(result.status).toBe('pending');
      expect(result.error_type).toBe('ITEM_ERROR');
      expect(result.error_code).toBe('ITEM_LOGIN_REQUIRED');
      expect(result.renewable).toBe(false);
      expect(result.requisitionStatus).toBe(status);
    },
  );

  // ------------------------------------------------------------------ expired
  it('maps EX (expired) to status=expired, renewable=true', () => {
    const result = mapRequisitionStatus('EX');
    expect(result.status).toBe('expired');
    expect(result.error_type).toBe('ITEM_ERROR');
    expect(result.error_code).toBe('ITEM_LOGIN_REQUIRED');
    expect(result.renewable).toBe(true);
    expect(result.requisitionStatus).toBe('EX');
  });

  // ------------------------------------------------------------------ rejected
  it('maps RJ (rejected) to status=rejected, renewable=true', () => {
    const result = mapRequisitionStatus('RJ');
    expect(result.status).toBe('rejected');
    expect(result.error_type).toBe('ITEM_ERROR');
    expect(result.error_code).toBe('ITEM_LOGIN_REQUIRED');
    expect(result.renewable).toBe(true);
    expect(result.requisitionStatus).toBe('RJ');
  });

  // ------------------------------------------------------------------ suspended
  it('maps SU (suspended) to status=suspended, renewable=true', () => {
    const result = mapRequisitionStatus('SU');
    expect(result.status).toBe('suspended');
    expect(result.error_type).toBe('ITEM_ERROR');
    expect(result.error_code).toBe('ITEM_LOGIN_REQUIRED');
    expect(result.renewable).toBe(true);
    expect(result.requisitionStatus).toBe('SU');
  });

  // ------------------------------------------------------------------ unknown
  it('maps undefined to status=unknown, renewable=false', () => {
    const result = mapRequisitionStatus(undefined);
    expect(result.status).toBe('unknown');
    expect(result.error_type).toBe('UNKNOWN');
    expect(result.error_code).toBe('UNKNOWN');
    expect(result.renewable).toBe(false);
    expect(result.requisitionStatus).toBeUndefined();
  });

  it('maps an unrecognised code to status=unknown, renewable=false', () => {
    const result = mapRequisitionStatus('XX');
    expect(result.status).toBe('unknown');
    expect(result.renewable).toBe(false);
    expect(result.requisitionStatus).toBe('XX');
  });

  // ------------------------------------------------------------------ LN (linked — not a path this fn is called for, but defensive)
  it('maps LN to status=unknown (mapRequisitionStatus is only called for non-linked requisitions)', () => {
    // LN should never reach this helper (it's filtered in getLinkedRequisition),
    // but if it does, it falls through to the default.
    const result = mapRequisitionStatus('LN');
    expect(result.status).toBe('unknown');
  });

  // ------------------------------------------------------------------ reason is always a non-empty string
  it.each(['CR', 'GC', 'UA', 'SA', 'GA', 'EX', 'RJ', 'SU', 'XX', undefined])(
    'always returns a non-empty reason string for status %s',
    (status) => {
      const result = mapRequisitionStatus(status);
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    },
  );
});
