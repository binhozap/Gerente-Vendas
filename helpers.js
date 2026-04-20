
// Funções auxiliares
export const formatCurrency = (value) => `R$ ${(value || 0).toFixed(2).replace('.', ',')}`;

export function formatCurrencyInput(input) {
    let value = input.value.replace(/\D/g, '');
    if (value === '') {
        input.value = '';
        return;
    }
    value = (parseInt(value, 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    input.value = value;
}

export function formatCsvField(field) {
    const stringField = field === null || field === undefined ? '' : String(field);
    return `"${stringField.replace(/"/g, '""')}"`;
}

export function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, delay);
    };
}
