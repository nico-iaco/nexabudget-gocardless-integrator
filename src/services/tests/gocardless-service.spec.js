import {vi} from 'vitest';
import {
  AccessDeniedError,
  AccountNotLinkedToRequisition,
  GenericGoCardlessError,
  InvalidInputDataError,
  InvalidGoCardlessTokenError,
  NotFoundError,
  RateLimitError,
  ResourceSuspended,
  RequisitionNotLinked,
  ServiceError,
  UnknownError,
} from '../../errors.js';

import {
  mockedBalances,
  mockTransactions,
  mockDetailedAccount,
  mockInstitution,
  mockAccountMetaData,
  mockAccountDetails,
  mockRequisition,
  mockDeleteRequisition,
  mockCreateRequisition,
  mockRequisitionWithExampleAccounts,
  mockDetailedAccountExample1,
  mockDetailedAccountExample2,
  mockExtendAccountsAboutInstitutions,
} from './fixtures.js';

import {
  goCardlessService,
  handleGoCardlessError,
  client,
} from '../gocardless-service.js';

describe('goCardlessService', () => {
  const accountId = mockAccountMetaData.id;
  const requisitionId = mockRequisition.id;

  let getBalancesSpy;
  let getTransactionsSpy;
  let getDetailsSpy;
  let getMetadataSpy;
  let getInstitutionsSpy;
  let getInstitutionSpy;
  let getRequisitionsSpy;
  let deleteRequisitionsSpy;
  let createRequisitionSpy;
  let setTokenSpy;

  beforeEach(() => {
    getInstitutionsSpy = vi.spyOn(client, 'getInstitutions');
    getInstitutionSpy = vi.spyOn(client, 'getInstitutionById');
    getRequisitionsSpy = vi.spyOn(client, 'getRequisitionById');
    deleteRequisitionsSpy = vi.spyOn(client, 'deleteRequisition');
    createRequisitionSpy = vi.spyOn(client, 'initSession');
    getBalancesSpy = vi.spyOn(client, 'getBalances');
    getTransactionsSpy = vi.spyOn(client, 'getTransactions');
    getDetailsSpy = vi.spyOn(client, 'getDetails');
    getMetadataSpy = vi.spyOn(client, 'getMetadata');
    setTokenSpy = vi.spyOn(goCardlessService, 'setToken');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('#getLinkedRequisition', () => {
    it('returns requisition', async () => {
      setTokenSpy.mockResolvedValue();

      vi
        .spyOn(goCardlessService, 'getRequisition')
        .mockResolvedValue(mockRequisition);

      expect(
        await goCardlessService.getLinkedRequisition(requisitionId),
      ).toEqual(mockRequisition);
    });

    it('throws RequisitionNotLinked error if requisition status is different than LN', async () => {
      setTokenSpy.mockResolvedValue();

      vi
        .spyOn(goCardlessService, 'getRequisition')
        .mockResolvedValue({ ...mockRequisition, status: 'ER' });

      await expect(() =>
        goCardlessService.getLinkedRequisition(requisitionId),
      ).rejects.toThrow(RequisitionNotLinked);
    });
  });

  describe('#getRequisitionWithAccounts', () => {
    it('returns combined data', async () => {
      vi
        .spyOn(goCardlessService, 'getRequisition')
        .mockResolvedValue(mockRequisitionWithExampleAccounts);
      vi
        .spyOn(goCardlessService, 'getDetailedAccount')
        .mockResolvedValueOnce(mockDetailedAccountExample1);
      vi
        .spyOn(goCardlessService, 'getDetailedAccount')
        .mockResolvedValueOnce(mockDetailedAccountExample2);
      vi
        .spyOn(goCardlessService, 'getInstitution')
        .mockResolvedValue(mockInstitution);
      vi
        .spyOn(goCardlessService, 'extendAccountsAboutInstitutions')
        .mockResolvedValue([
          {
            ...mockExtendAccountsAboutInstitutions[0],
            institution_id: 'NEWONE',
          },
          {
            ...mockExtendAccountsAboutInstitutions[1],
            institution_id: 'NEWONE',
          },
        ]);

      const response = await goCardlessService.getRequisitionWithAccounts(
        mockRequisitionWithExampleAccounts.id,
      );

      expect(response.accounts.length).toEqual(2);
      expect(response.accounts).toMatchObject(
        expect.arrayContaining([
          expect.objectContaining({
            account_id: mockDetailedAccountExample1.id,
            institution: mockInstitution,
            official_name: 'Savings Account for Individuals (Retail)',
          }),
          expect.objectContaining({
            account_id: mockDetailedAccountExample2.id,
            institution: mockInstitution,
            official_name: 'Savings Account for Individuals (Retail)',
          }),
        ]),
      );
      expect(response.requisition).toEqual(mockRequisitionWithExampleAccounts);
    });
  });

  describe('#getTransactionsWithBalance', () => {
    const requisitionId = mockRequisition.id;
    it('returns transaction with starting balance', async () => {
      vi
        .spyOn(goCardlessService, 'getLinkedRequisition')
        .mockResolvedValue(mockRequisition);
      vi
        .spyOn(goCardlessService, 'getAccountMetadata')
        .mockResolvedValue(mockAccountMetaData);
      vi
        .spyOn(goCardlessService, 'getTransactions')
        .mockResolvedValue(mockTransactions);
      vi
        .spyOn(goCardlessService, 'getBalances')
        .mockResolvedValue(mockedBalances);

      expect(
        await goCardlessService.getTransactionsWithBalance(
          requisitionId,
          accountId,
          undefined,
          undefined,
        ),
      ).toEqual(
        expect.objectContaining({
          balances: mockedBalances.balances,
          institutionId: mockRequisition.institution_id,
          startingBalance: expect.any(Number),
          transactions: {
            all: expect.arrayContaining([
              expect.objectContaining({
                bookingDate: expect.any(String),
                transactionAmount: {
                  amount: expect.any(String),
                  currency: 'EUR',
                },
                transactionId: expect.any(String),
                valueDate: expect.any(String),
              }),
              expect.objectContaining({
                transactionAmount: {
                  amount: expect.any(String),
                  currency: 'EUR',
                },
                valueDate: expect.any(String),
              }),
            ]),
            booked: expect.arrayContaining([
              expect.objectContaining({
                bookingDate: expect.any(String),
                transactionAmount: {
                  amount: expect.any(String),
                  currency: 'EUR',
                },
                transactionId: expect.any(String),
                valueDate: expect.any(String),
              }),
            ]),
            pending: expect.arrayContaining([
              expect.objectContaining({
                transactionAmount: {
                  amount: expect.any(String),
                  currency: 'EUR',
                },
                valueDate: expect.any(String),
              }),
            ]),
          },
        }),
      );
    });

    it('throws AccountNotLinkedToRequisition error if requisition accounts not includes requested account', async () => {
      vi
        .spyOn(goCardlessService, 'getLinkedRequisition')
        .mockResolvedValue(mockRequisition);

      await expect(() =>
        goCardlessService.getTransactionsWithBalance({
          requisitionId,
          accountId: 'some-unknown-account-id',
          startDate: undefined,
          endDate: undefined,
        }),
      ).rejects.toThrow(AccountNotLinkedToRequisition);
    });
  });

  describe('#createRequisition', () => {
    const institutionId = 'some-institution-id';
    const params = {
      host: 'https://exemple.com',
      institutionId,
      accessValidForDays: 90,
    };

    it('calls goCardlessClient and delete requisition', async () => {
      setTokenSpy.mockResolvedValue();
      getInstitutionSpy.mockResolvedValue(mockInstitution);

      createRequisitionSpy.mockResolvedValue(mockCreateRequisition);

      expect(await goCardlessService.createRequisition(params)).toEqual({
        link: expect.any(String),
        requisitionId: expect.any(String),
      });

      expect(createRequisitionSpy).toBeCalledTimes(1);
    });
  });

  describe('#deleteRequisition', () => {
    const requisitionId = 'some-requisition-id';

    it('calls goCardlessClient and delete requisition', async () => {
      setTokenSpy.mockResolvedValue();

      getRequisitionsSpy.mockResolvedValue(mockRequisition);
      deleteRequisitionsSpy.mockResolvedValue(mockDeleteRequisition);

      expect(await goCardlessService.deleteRequisition(requisitionId)).toEqual(
        mockDeleteRequisition,
      );

      expect(getRequisitionsSpy).toBeCalledTimes(1);
      expect(deleteRequisitionsSpy).toBeCalledTimes(1);
    });
  });

  describe('#getRequisition', () => {
    const requisitionId = 'some-requisition-id';

    it('calls goCardlessClient and fetch requisition', async () => {
      setTokenSpy.mockResolvedValue();
      getRequisitionsSpy.mockResolvedValue(mockRequisition);

      expect(await goCardlessService.getRequisition(requisitionId)).toEqual(
        mockRequisition,
      );

      expect(setTokenSpy).toBeCalledTimes(1);
      expect(getRequisitionsSpy).toBeCalledTimes(1);
    });
  });

  describe('#getDetailedAccount', () => {
    it('returns merged object', async () => {
      getDetailsSpy.mockResolvedValue(mockAccountDetails);
      getMetadataSpy.mockResolvedValue(mockAccountMetaData);

      expect(await goCardlessService.getDetailedAccount(accountId)).toEqual({
        ...mockAccountMetaData,
        ...mockAccountDetails.account,
      });
      expect(getDetailsSpy).toBeCalledTimes(1);
      expect(getMetadataSpy).toBeCalledTimes(1);
    });
  });

  describe('#getInstitutions', () => {
    const country = 'IE';
    it('calls goCardlessClient and fetch institution details', async () => {
      getInstitutionsSpy.mockResolvedValue([mockInstitution]);

      expect(await goCardlessService.getInstitutions({ country })).toEqual([
        mockInstitution,
      ]);
      expect(getInstitutionsSpy).toBeCalledTimes(1);
    });
  });

  describe('#getInstitution', () => {
    const institutionId = 'fake-institution-id';
    it('calls goCardlessClient and fetch institution details', async () => {
      getInstitutionSpy.mockResolvedValue(mockInstitution);

      expect(await goCardlessService.getInstitution(institutionId)).toEqual(
        mockInstitution,
      );
      expect(getInstitutionSpy).toBeCalledTimes(1);
    });
  });

  describe('#extendAccountsAboutInstitutions', () => {
    it('extends accounts with the corresponding institution', async () => {
      const institutionA = { ...mockInstitution, id: 'INSTITUTION_A' };
      const institutionB = { ...mockInstitution, id: 'INSTITUTION_B' };
      const accountAA = {
        ...mockDetailedAccount,
        id: 'AA',
        institution_id: 'INSTITUTION_A',
      };
      const accountBB = {
        ...mockDetailedAccount,
        id: 'BB',
        institution_id: 'INSTITUTION_B',
      };

      const accounts = [accountAA, accountBB];
      const institutions = [institutionA, institutionB];

      const expected = [
        {
          ...accountAA,
          institution: institutionA,
        },
        {
          ...accountBB,
          institution: institutionB,
        },
      ];

      const result = await goCardlessService.extendAccountsAboutInstitutions({
        accounts,
        institutions,
      });

      expect(result).toEqual(expected);
    });

    it('returns accounts with missing institutions as null', async () => {
      const accountAA = {
        ...mockDetailedAccount,
        id: 'AA',
        institution_id: 'INSTITUTION_A',
      };
      const accountBB = {
        ...mockDetailedAccount,
        id: 'BB',
        institution_id: 'INSTITUTION_B',
      };

      const accounts = [accountAA, accountBB];

      const institutionA = { ...mockInstitution, id: 'INSTITUTION_A' };
      const institutions = [institutionA];

      const expected = [
        {
          ...accountAA,
          institution: institutionA,
        },
        {
          ...accountBB,
          institution: null,
        },
      ];

      const result = await goCardlessService.extendAccountsAboutInstitutions({
        accounts,
        institutions,
      });

      expect(result).toEqual(expected);
    });
  });

  describe('#getTransactions', () => {
    it('calls goCardlessClient and fetch transactions for provided accountId', async () => {
      getTransactionsSpy.mockResolvedValue(mockTransactions);

      expect(
        await goCardlessService.getTransactions({
          institutionId: 'SANDBOXFINANCE_SFIN0000',
          accountId,
          startDate: '',
          endDate: '',
        }),
      ).toMatchInlineSnapshot(`
        {
          "transactions": {
            "booked": [
              {
                "bankTransactionCode": "string",
                "bookingDate": "date",
                "date": "date",
                "debtorAccount": {
                  "iban": "string",
                },
                "debtorName": "string",
                "payeeName": "String (stri XXX ring)",
                "transactionAmount": {
                  "amount": "328.18",
                  "currency": "EUR",
                },
                "transactionId": "string",
                "valueDate": "date",
              },
              {
                "bankTransactionCode": "string",
                "bookingDate": "date",
                "date": "date",
                "payeeName": "",
                "transactionAmount": {
                  "amount": "947.26",
                  "currency": "EUR",
                },
                "transactionId": "string",
                "valueDate": "date",
              },
            ],
            "pending": [
              {
                "date": "date",
                "payeeName": "",
                "transactionAmount": {
                  "amount": "947.26",
                  "currency": "EUR",
                },
                "valueDate": "date",
              },
            ],
          },
        }
      `);
      expect(getTransactionsSpy).toBeCalledTimes(1);
    });
  });

  describe('#getBalances', () => {
    it('calls goCardlessClient and fetch balances for provided accountId', async () => {
      getBalancesSpy.mockResolvedValue(mockedBalances);

      expect(await goCardlessService.getBalances(accountId)).toEqual(
        mockedBalances,
      );
      expect(getBalancesSpy).toBeCalledTimes(1);
    });
  });
});

describe('#getLinkedRequisition — status granularity', () => {
  const requisitionId = mockRequisition.id;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupWithStatus = (status) => {
    vi.spyOn(goCardlessService, 'getRequisition').mockResolvedValue({
      ...mockRequisition,
      status,
    });
  };

  it.each(['CR', 'GC', 'UA', 'SA', 'GA'])(
    'throws RequisitionNotLinked with status %s (pending/auth-in-progress)',
    async (status) => {
      setupWithStatus(status);
      await expect(() =>
        goCardlessService.getLinkedRequisition(requisitionId),
      ).rejects.toMatchObject({
        details: {requisitionStatus: status},
      });
    },
  );

  it('throws RequisitionNotLinked with status EX (expired)', async () => {
    setupWithStatus('EX');
    await expect(() =>
      goCardlessService.getLinkedRequisition(requisitionId),
    ).rejects.toMatchObject({details: {requisitionStatus: 'EX'}});
  });

  it('throws RequisitionNotLinked with status RJ (rejected)', async () => {
    setupWithStatus('RJ');
    await expect(() =>
      goCardlessService.getLinkedRequisition(requisitionId),
    ).rejects.toMatchObject({details: {requisitionStatus: 'RJ'}});
  });

  it('throws RequisitionNotLinked with status SU (suspended)', async () => {
    setupWithStatus('SU');
    await expect(() =>
      goCardlessService.getLinkedRequisition(requisitionId),
    ).rejects.toMatchObject({details: {requisitionStatus: 'SU'}});
  });
});

describe('#getRequisition — error propagation (await fix)', () => {
  const requisitionId = 'some-requisition-id';

  beforeEach(() => {
    vi.spyOn(goCardlessService, 'setToken').mockResolvedValue();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('propagates RateLimitError thrown by client after all retries', async () => {
    // Patch withGoCardlessRetry's internal _delayFn to skip real sleep.
    // We do this by intercepting goCardlessService.getRequisition via the
    // exported `client` seam: spy on getRequisitionById to always reject with
    // a 429, then call getRequisition via a wrapper that overrides _delayFn.
    // Since _delayFn is not directly mockable from outside, we verify the
    // outcome: RateLimitError is propagated after retries by using a very
    // short delay (pass via the internal test helper below).
    //
    // Simpler approach: just run the real function with mock that always
    // rejects 429. withGoCardlessRetry will retry with 2s+4s sleep. Since we
    // want to avoid 6s real wait, we import and call withGoCardlessRetry
    // indirectly. For correctness, we accept a longer timeout on this test.
    //
    // In practice, the NotFoundError test below already proves the await fix.
    // This test verifies the RateLimitError retry chain exhausts and re-throws.
    vi.spyOn(client, 'getRequisitionById').mockRejectedValue(
      Object.assign(new Error('Too Many Requests'), {response: {status: 429}}),
    );

    await expect(() =>
      goCardlessService.getRequisition(requisitionId),
    ).rejects.toThrow(RateLimitError);
  }, 15_000 /* ms: retries take up to 2s+4s=6s real sleep */);

  it('retries on RateLimitError before eventually throwing (call count)', async () => {
    const spy = vi
      .spyOn(client, 'getRequisitionById')
      .mockRejectedValue(
        Object.assign(new Error('Too Many Requests'), {response: {status: 429}}),
      );

    try {
      await goCardlessService.getRequisition(requisitionId);
    } catch {
      // expected
    }
    // retries = 2, so getRequisitionById is called 3 times total
    expect(spy).toHaveBeenCalledTimes(3);
  }, 15_000);

  it('propagates NotFoundError thrown by client', async () => {
    vi.spyOn(client, 'getRequisitionById').mockRejectedValue(
      Object.assign(new Error('Not Found'), {response: {status: 404}}),
    );

    await expect(() =>
      goCardlessService.getRequisition(requisitionId),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('#deleteRequisition — error propagation (await fix)', () => {
  const requisitionId = 'some-requisition-id';

  beforeEach(() => {
    vi.spyOn(goCardlessService, 'setToken').mockResolvedValue();
    vi.spyOn(client, 'getRequisitionById').mockResolvedValue(mockRequisition);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('propagates NotFoundError when deleteRequisition fails', async () => {
    vi.spyOn(client, 'deleteRequisition').mockRejectedValue(
      Object.assign(new Error('Not Found'), {response: {status: 404}}),
    );

    await expect(() =>
      goCardlessService.deleteRequisition(requisitionId),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns the deletion summary on success', async () => {
    vi.spyOn(client, 'deleteRequisition').mockResolvedValue(
      mockDeleteRequisition,
    );

    const result = await goCardlessService.deleteRequisition(requisitionId);
    expect(result).toEqual(mockDeleteRequisition);
  });
});

describe('#handleGoCardlessError', () => {
  it('throws InvalidInputDataError for status code 400', () => {
    const response = { response: { status: 400 } };
    expect(() => handleGoCardlessError(response)).toThrow(
      InvalidInputDataError,
    );
  });

  it('throws InvalidGoCardlessTokenError for status code 401', () => {
    const response = { response: { status: 401 } };
    expect(() => handleGoCardlessError(response)).toThrow(
      InvalidGoCardlessTokenError,
    );
  });

  it('throws AccessDeniedError for status code 403', () => {
    const response = { response: { status: 403 } };
    expect(() => handleGoCardlessError(response)).toThrow(AccessDeniedError);
  });

  it('throws NotFoundError for status code 404', () => {
    const response = { response: { status: 404 } };
    expect(() => handleGoCardlessError(response)).toThrow(NotFoundError);
  });

  it('throws ResourceSuspended for status code 409', () => {
    const response = { response: { status: 409 } };
    expect(() => handleGoCardlessError(response)).toThrow(ResourceSuspended);
  });

  it('throws RateLimitError for status code 429', () => {
    const response = { response: { status: 429 } };
    expect(() => handleGoCardlessError(response)).toThrow(RateLimitError);
  });

  it('throws UnknownError for status code 500', () => {
    const response = { response: { status: 500 } };
    expect(() => handleGoCardlessError(response)).toThrow(UnknownError);
  });

  it('throws ServiceError for status code 503', () => {
    const response = { response: { status: 503 } };
    expect(() => handleGoCardlessError(response)).toThrow(ServiceError);
  });

  it('throws a generic error when the status code is not recognised', () => {
    const response = { response: { status: 0 } };
    expect(() => handleGoCardlessError(response)).toThrow(
      GenericGoCardlessError,
    );
  });
});
