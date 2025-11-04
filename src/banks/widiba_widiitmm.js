import * as d from 'date-fns';
import Fallback from './integration-bank.js';

/** @type {import('./bank.interface.js').IBank} */
export default {
    ...Fallback,
    institutionIds: ['WIDIBA_WIDIITMM'],
    normalizeTransaction(transaction, _booked) {
        const remittance = transaction.remittanceInformationUnstructured;

        if (remittance) {
            // Controlla se c'è "DA" seguito dal nome nel contesto BANCOMAT Pay
            const bpayMatch = remittance.match(/RICEZIONE DENARO CON BANCOMAT PAY DA ([^D]+?)(?=\s+DATA:)/i);
            if (bpayMatch) {
                const date =
                    transaction.bookingDate ||
                    transaction.bookingDateTime ||
                    transaction.valueDate ||
                    transaction.valueDateTime;

                return {
                    ...transaction,
                    payeeName: `da ${bpayMatch[1].trim().toLowerCase()}`,
                    date: d.format(d.parseISO(date), 'yyyy-MM-dd'),
                };
            }

            // Controlla se c'è "Caus:" e estrae la causale
            const causMatch = remittance.match(/Caus:\s*\d+\s+(.+)$/i);
            if (causMatch) {
                const date =
                    transaction.bookingDate ||
                    transaction.bookingDateTime ||
                    transaction.valueDate ||
                    transaction.valueDateTime;

                return {
                    ...transaction,
                    payeeName: causMatch[1].trim(),
                    date: d.format(d.parseISO(date), 'yyyy-MM-dd'),
                };
            }

            // Controlla se c'è "ESERCENTE:"
            if (/esercente:/i.test(remittance)) {
                const match = remittance.match(/esercente:\s*([^-]+)/i);

                if (match) {
                    const date =
                        transaction.bookingDate ||
                        transaction.bookingDateTime ||
                        transaction.valueDate ||
                        transaction.valueDateTime;

                    return {
                        ...transaction,
                        payeeName: match[1].trim(),
                        date: d.format(d.parseISO(date), 'yyyy-MM-dd'),
                    };
                }
            }
        }

        return Fallback.normalizeTransaction(transaction, _booked);
    },
};
