import { describe, it, expect } from 'vitest';
import WidibaWidiitmm from '../widiba_widiitmm.js';

describe('WidibaWidiitmm', () => {
    describe('#normalizeTransaction', () => {
        it('extracts payeeName from ESERCENTE field', () => {
            const transaction = {
                transactionAmount: { amount: '-8.00', currency: 'EUR' },
                remittanceInformationUnstructured:
                    'Causale: PAGAM. CIRCUITO INTERNAZ. - Descrizione: DATA 28/10/25 ORA 14.13 LOC.ROMA ESERCENTE: TRENITALIA - PT WL IMP.IN DIV.ORIG 8,00 N.CARTA: 00585328 APPLE PAY',
                bookingDate: '2025-10-28',
            };

            const normalizedTransaction = WidibaWidiitmm.normalizeTransaction(
                transaction,
                true,
            );

            expect(normalizedTransaction.payeeName).toEqual('TRENITALIA');
            expect(normalizedTransaction.date).toEqual('2025-10-28');
        });

        it('uses fallback when ESERCENTE is not present', () => {
            const transaction = {
                transactionAmount: { amount: '-10.00', currency: 'EUR' },
                remittanceInformationUnstructured: 'Bonifico ordinario',
                bookingDate: '2025-10-28',
            };

            const normalizedTransaction = WidibaWidiitmm.normalizeTransaction(
                transaction,
                true,
            );

            expect(normalizedTransaction.payeeName).toEqual('Bonifico Ordinario');
        });

        it('extracts payeeName from Caus field in bonifico istantaneo', () => {
            const transaction = {
                transactionAmount: { amount: '-100.00', currency: 'EUR' },
                remittanceInformationUnstructured:
                    'Causale: Pagamento Istantaneo - Descrizione: Bon. Ist. A100995029903442481423903200it Data Accett. 28.10.25 * Data Esec. 28.10.25 a Favore Nome Cognome Iban It61c0301508300000004247907 Comm. Bon 0,00 Caus: 048 Regalo',
                bookingDate: '2025-10-28',
            };

            const normalizedTransaction = WidibaWidiitmm.normalizeTransaction(
                transaction,
                true,
            );

            expect(normalizedTransaction.payeeName).toEqual('Regalo');
            expect(normalizedTransaction.date).toEqual('2025-10-28');
        });

        it('extracts payeeName from BANCOMAT Pay transfer', () => {
            const transaction = {
                transactionAmount: { amount: '50.00', currency: 'EUR' },
                remittanceInformationUnstructured:
                    'Causale: TRASFERIMENTO DENARO BPAY - Descrizione: FILIALE DISPONENTE 00102 BANCOMAT Pay - XXX RICEZIONE DENARO CON BANCOMAT PAY DA NOME COGNOME DATA: 02-06-2025 ORE: 19.45 CAUS: P2P0003XXX BIC: XXX IND:VIA XXX 33',
                bookingDate: '2025-06-02',
            };

            const normalizedTransaction = WidibaWidiitmm.normalizeTransaction(
                transaction,
                true,
            );

            expect(normalizedTransaction.payeeName).toEqual('da nome cognome');
            expect(normalizedTransaction.date).toEqual('2025-06-02');
        });

        it('extracts payeeName from SDD direct debit', () => {
            const transaction = {
                transactionAmount: { amount: '-200.00', currency: 'EUR' },
                remittanceInformationUnstructured:
                    'Causale: Addebito Diretto Sdd - Descrizione: Addebito Sdd N. XXXXX a Favore Mfm Investment Ltd Italian Branch Codice Mandato 34336 Importo 200,00 Commissioni 0,00 Spese 0,00 Ni25XXXX',
                bookingDate: '2025-06-02',
            };

            const normalizedTransaction = WidibaWidiitmm.normalizeTransaction(
                transaction,
                true,
            );

            expect(normalizedTransaction.payeeName).toEqual(
                'Addebito Sdd N. XXXXX a Favore Mfm Investment Ltd Italian Branch'
            );
            expect(normalizedTransaction.date).toEqual('2025-06-02');
        });


    });
});
