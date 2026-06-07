/**
 * GoCardless requisition status codes and their meanings:
 *
 * LN  - Linked           : accounts successfully linked, ready to use
 * CR  - Created          : requisition created, consent page not yet visited
 * GC  - Giving Consent   : user is on the consent screen
 * UA  - Undergoing Auth  : bank authentication in progress
 * SA  - Selecting Accts  : user is selecting accounts in the bank UI
 * GA  - Granting Access  : user is granting access
 * RJ  - Rejected         : consent was denied / SCA failed
 * SU  - Suspended        : suspended after too many errors (by GoCardless)
 * EX  - Expired          : End User Agreement expired; access revoked
 */

const PENDING_STATUSES = new Set(['CR', 'GC', 'UA', 'SA', 'GA']);

/**
 * Maps a raw GoCardless requisition status code to an actionable response shape.
 *
 * @param {string | undefined} requisitionStatus - Raw GoCardless status code
 * @returns {{
 *   status: string,
 *   error_type: string,
 *   error_code: string,
 *   reason: string,
 *   renewable: boolean,
 *   requisitionStatus: string | undefined
 * }}
 */
export const mapRequisitionStatus = (requisitionStatus) => {
    if (PENDING_STATUSES.has(requisitionStatus)) {
        return {
            status: 'pending',
            error_type: 'ITEM_ERROR',
            error_code: 'ITEM_LOGIN_REQUIRED',
            reason: 'Bank consent or authentication not yet completed — use the original link to continue',
            renewable: false,
            requisitionStatus,
        };
    }

    switch (requisitionStatus) {
        case 'EX':
            return {
                status: 'expired',
                error_type: 'ITEM_ERROR',
                error_code: 'ITEM_LOGIN_REQUIRED',
                reason: 'Access to account has expired as set in End User Agreement — a new requisition is required',
                renewable: true,
                requisitionStatus,
            };

        case 'RJ':
            return {
                status: 'rejected',
                error_type: 'ITEM_ERROR',
                error_code: 'ITEM_LOGIN_REQUIRED',
                reason: 'Bank consent was denied or SCA failed — a new requisition is required',
                renewable: true,
                requisitionStatus,
            };

        case 'SU':
            return {
                status: 'suspended',
                error_type: 'ITEM_ERROR',
                error_code: 'ITEM_LOGIN_REQUIRED',
                reason: 'Requisition was suspended due to repeated errors — a new requisition is required',
                renewable: true,
                requisitionStatus,
            };

        default:
            return {
                status: 'unknown',
                error_type: 'UNKNOWN',
                error_code: 'UNKNOWN',
                reason: `Unexpected requisition status: ${requisitionStatus}`,
                renewable: false,
                requisitionStatus,
            };
    }
};
