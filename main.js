
import * as dbService from './database.js';
import { formatCurrencyInput, debounce } from './helpers.js';
import {
    handleFormCadastroSubmit,
    handleExcluirCliente,
    handleFormVendasSubmit,
    abrirModalParaEdicao,
    handleBackup,
    handleRestore
} from './handlers.js';
import {
    abrirModalRelatorio,
    gerarPdfCliente,
    enviarRelatorioWhatsapp,
    copiarTextoRelatorio,
    enviarLembretesVencimentosProximos, 
    exportarDadosCsv,
    exportarDadosClienteCsv
} from './reports.js';
import {
    initUI,
    applyTheme,
    adicionarClienteNaLista,
    criarCardCliente,
    filtrarClientes,
    verificarListaClientesVazia,
    renderVendasForCliente,
    atualizarSelectClientes,
    limparFormularioVendas,
    atualizarVisaoGeralFinanceira, 
    atualizarLembretesAniversario,
    calcularEExibirParcelasPreview, 
    ordenarClientes
} from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // NEW: Registra o Service Worker para funcionalidade offline
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('Service Worker registrado com sucesso:', registration);
                })
                .catch(error => {
                    console.log('Falha ao registrar o Service Worker:', error);
                });
        });
    }

    // ==================================================
    // SELEÇÃO DE ELEMENTOS DO DOM
    // ==================================================
    const btnCadastrar = document.getElementById("btn-cadastrar");
    const modalCadastro = document.getElementById("modal-cadastro");
    const btnFecharModal = document.getElementById("fechar-modal");
    const formCadastro = document.getElementById("form-cadastro");
    const inputNome = document.getElementById("input-nome");
    const inputDataNascimento = document.getElementById("input-data-nascimento"); // NEW
    const inputEndereco = document.getElementById("input-endereco"); // NEW
    const inputTelefone = document.getElementById("input-telefone");
    const clientesLista = modalCadastro.querySelector(".lista-modal");

    const btnVender = document.getElementById("btn-vender");
    const modalVendas = document.getElementById("modal-vendas");
    const btnFecharModalVendas = document.getElementById("fechar-modal-vendas");
    const btnDevedores = document.getElementById("btn-produtos");
    const formVendas = document.getElementById("form-vendas");
    const btnLimparVendas = document.getElementById("btn-limpar-vendas");    
    // Elementos do select customizado
    const customSelectContainer = document.getElementById("custom-select-cliente");
    const selectCliente_venda_input = document.getElementById("select-cliente-venda-input");
    const selectCliente_venda_hidden = document.getElementById("select-cliente-venda-hidden");
    const customSelectList = document.getElementById("custom-select-cliente-list");
    const customSelectSearch = document.getElementById("custom-select-cliente-search");
    const customSelectOptionsContainer = document.getElementById("custom-select-options-container");
    const inputProdutoVenda = document.getElementById("input-produto-venda");
    const inputValorVenda = document.getElementById("input-valor-venda");
    const inputDescontoVenda = document.getElementById("input-desconto-venda");
    // Elementos do seletor de método de pagamento
    const paymentMethodGroup = document.querySelector(".payment-method-group");
    const metodoPagamentoHidden = document.getElementById("metodo-pagamento-hidden");
    const inputObservacaoVenda = document.getElementById("input-observacao-venda");
    const containerDataVencimento = document.getElementById("container-data-vencimento");
    const selectDataVencimento = document.getElementById("select-data-vencimento");
    const containerParceladoOpcoes = document.getElementById("container-parcelado-opcoes");
    const inputParcelas = document.getElementById("input-parcelas");
    const inputEntrada = document.getElementById("input-entrada");
    const vendasRegistradasLista = document.getElementById("vendas-registradas-lista");
    const parcelasPreviewEl = document.getElementById("parcelas-preview"); // NEW
    const totalGeralDevidoEl = document.getElementById("total-geral-devido");
    const modalRelatorio = document.getElementById("modal-relatorio-devedores");
    const btnFecharModalRelatorio = document.getElementById("fechar-modal-relatorio");
    const relatorioConteudoEl = document.getElementById("relatorio-conteudo");
    // Elementos do select customizado de relatório
    const customSelectReportContainer = document.getElementById("custom-select-report");
    const selectClientePdfInput = document.getElementById("select-cliente-pdf-input");
    const selectClientePdfHidden = document.getElementById("select-cliente-pdf-hidden");
    const customSelectReportList = document.getElementById("custom-select-report-list");
    const customSelectReportSearch = document.getElementById("custom-select-report-search");
    const customSelectReportOptionsContainer = document.getElementById("custom-select-report-options-container");
    const btnGerarPdf = document.getElementById("btn-gerar-pdf");
    const btnEnviarWhatsappRelatorio = document.getElementById("btn-enviar-whatsapp-relatorio");
    const btnCopiarRelatorio = document.getElementById("btn-copiar-relatorio"); // NEW
    const btnLembreteVencimentos = document.getElementById("btn-lembrete-vencimentos");
    const graficoDevedoresCanvas = document.getElementById('grafico-devedores-pizza');
    const btnExportarCsv = document.getElementById("btn-exportar-csv");
    const inputBuscaCliente = document.getElementById("input-busca-cliente");
    const sortMethodGroup = document.getElementById("sort-method-group"); // NEW
    const vencimentosSummaryEl = document.getElementById("vencimentos-summary");
    const btnBackupDb = document.getElementById("btn-backup-db");
    const aniversariosSummaryEl = document.getElementById("aniversarios-summary"); // NEW
    const btnRestoreDb = document.getElementById("btn-restore-db");
    const inputRestoreDb = document.getElementById("input-restore-db");
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const btnSettings = document.getElementById("btn-settings"); 
    const modalSettings = document.getElementById("modal-settings");
    const btnFecharModalSettings = document.getElementById("fechar-modal-settings");
    const formSettings = document.getElementById("form-settings");
    const templateRelatorioTextarea = document.getElementById("template-relatorio");
    const templateLembreteTextarea = document.getElementById("template-lembrete");
    const mainContainer = document.querySelector('.Main');
    const loadingOverlay = document.getElementById('loading-overlay');
    const modalClienteDetalhes = document.getElementById("modal-cliente-detalhes"); // NEW
    const btnFecharModalClienteDetalhes = document.getElementById("fechar-modal-cliente-detalhes"); // NEW
    const btnExportarCliente = document.getElementById("btn-exportar-cliente"); // NEW
    const clienteDetalhesNomeEl = document.getElementById("cliente-detalhes-nome"); // NEW
    const clienteDetalhesInfoEl = document.getElementById("cliente-detalhes-info"); // NEW
    const clienteDetalhesVendasListaEl = document.getElementById("cliente-detalhes-vendas-lista"); // NEW
    let graficoDevedoresInstance = null;
    
    initUI(totalGeralDevidoEl, vencimentosSummaryEl, aniversariosSummaryEl, modalClienteDetalhes, clienteDetalhesNomeEl, clienteDetalhesInfoEl, clienteDetalhesVendasListaEl, parcelasPreviewEl); // Updated

    // ==================================================
    // INICIALIZAÇÃO
    // ==================================================

    // Aplica o tema salvo ao carregar a página
    const savedTheme = localStorage.getItem('fiqueBellaTheme') || 'dark';
    applyTheme(savedTheme, mainContainer);
    
    // Mostra o spinner de carregamento
    loadingOverlay.classList.remove('hidden');

    // Inicia o banco de dados
    dbService.initDB(renderAllFromDB);

    async function renderAllFromDB() {
        try {
            // Esconde o spinner de carregamento
            loadingOverlay.classList.add('hidden');
            const clientes = await dbService.getClientes();
            vendasRegistradasLista.innerHTML = '';
            clientesLista.innerHTML = '';

            for (const nomeCliente of clientes) {
                adicionarClienteNaLista(nomeCliente, clientesLista, (nome, el) => handleExcluirCliente(nome, el, vendasRegistradasLista, null, customSelectReportOptionsContainer, totalGeralDevidoEl, vencimentosSummaryEl, loadingOverlay));
                const card = await criarCardCliente(nomeCliente, vendasRegistradasLista, (nome, el) => handleExcluirCliente(nome, el, vendasRegistradasLista, customSelectOptionsContainer, customSelectReportOptionsContainer, totalGeralDevidoEl, vencimentosSummaryEl));
                if (card) {
                    // CORREÇÃO: Passa a lista de compras dentro do card, e não o card inteiro.
                    const listaComprasEl = card.querySelector('.lista-compras');
                    await renderVendasForCliente(listaComprasEl, nomeCliente, null, (vendaId, nome) => abrirModalParaEdicao(vendaId, nome, formVendas, selectCliente_venda_input, selectCliente_venda_hidden, inputProdutoVenda, inputValorVenda, inputDescontoVenda, paymentMethodGroup, metodoPagamentoHidden, inputEntrada, inputParcelas, selectDataVencimento, inputObservacaoVenda, containerParceladoOpcoes, containerDataVencimento, modalVendas));
                }
            }
            atualizarVisaoGeralFinanceira();
            verificarListaClientesVazia(vendasRegistradasLista);

            atualizarLembretesAniversario(); // NEW

            // NEW: Verifica aniversários do dia para notificação
            await verificarAniversariosDoDia();
            // NEW: Verifica vencimentos do dia para notificação
            await verificarVencimentosDoDia();
        } catch (error) { console.error("Erro ao renderizar dados do DB:", error); }
    }

    // ==================================================
    // EVENT LISTENERS
    // ==================================================

    themeToggleBtn.addEventListener('click', () => {
        const isLight = mainContainer.classList.contains('light-theme');
        const newTheme = isLight ? 'dark' : 'light';
        localStorage.setItem('fiqueBellaTheme', newTheme);
        applyTheme(newTheme, mainContainer);
    });

    btnCadastrar.addEventListener("click", () => {
        modalCadastro.showModal();
    });

    btnFecharModal.addEventListener("click", () => {
        modalCadastro.close();
    });

    modalCadastro.addEventListener("click", (event) => {
        if (event.target === modalCadastro) {
            modalCadastro.close();
        }
    });

    btnVender.addEventListener("click", () => {
        atualizarSelectClientes(customSelectOptionsContainer, customSelectReportOptionsContainer);
        modalVendas.showModal();
    });

    btnFecharModalVendas.addEventListener("click", () => {
        modalVendas.close();
    });

    modalVendas.addEventListener("click", (event) => {
        if (event.target === modalVendas) {
            modalVendas.close();
        }
    });

    // --- Lógica do Select Customizado ---
    selectCliente_venda_input.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelectList.classList.toggle('hidden');
        if (!customSelectList.classList.contains('hidden')) {
            customSelectSearch.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!customSelectContainer.contains(e.target)) {
            customSelectList.classList.add('hidden');
        }
    });

    customSelectSearch.addEventListener('input', () => {
        const filter = customSelectSearch.value.toLowerCase();
        const options = customSelectOptionsContainer.querySelectorAll('.custom-select-option');
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.classList.toggle('hidden', !text.includes(filter));
        });
    });

    customSelectOptionsContainer.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('custom-select-option')) {
            const selectedValue = e.target.dataset.value;
            selectCliente_venda_input.value = selectedValue;
            selectCliente_venda_hidden.value = selectedValue;
            customSelectList.classList.add('hidden');
            customSelectSearch.value = ''; // Limpa a busca
            customSelectOptionsContainer.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('hidden')); // Mostra todas as opções novamente
        }
    });

    // --- Lógica do Select Customizado de Relatório ---
    selectClientePdfInput.addEventListener('click', (e) => {
        e.stopPropagation();
        customSelectReportList.classList.toggle('hidden');
        if (!customSelectReportList.classList.contains('hidden')) {
            customSelectReportSearch.focus();
        }
    });

    document.addEventListener('click', (e) => {
        if (!customSelectReportContainer.contains(e.target)) {
            customSelectReportList.classList.add('hidden');
        }
    });

    customSelectReportSearch.addEventListener('input', () => {
        const filter = customSelectReportSearch.value.toLowerCase();
        const options = customSelectReportOptionsContainer.querySelectorAll('.custom-select-option');
        options.forEach(option => {
            const text = option.textContent.toLowerCase();
            option.classList.toggle('hidden', !text.includes(filter));
        });
    });

    customSelectReportOptionsContainer.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('custom-select-option')) {
            const selectedValue = e.target.dataset.value;
            selectClientePdfInput.value = selectedValue;
            selectClientePdfHidden.value = selectedValue;
            customSelectReportList.classList.add('hidden');
            customSelectReportSearch.value = ''; // Limpa a busca
            customSelectReportOptionsContainer.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('hidden')); // Mostra todas as opções novamente
        }
    });

    // NEW: Event listeners para o modal de detalhes do cliente
    btnFecharModalClienteDetalhes.addEventListener("click", () => {
        modalClienteDetalhes.close();
    });

    modalClienteDetalhes.addEventListener("click", (event) => {
        if (event.target === modalClienteDetalhes) {
            modalClienteDetalhes.close();
        }
    });

    // --- Lógica do Seletor de Método de Pagamento ---
    paymentMethodGroup.addEventListener('click', (e) => {
        if (e.target.classList.contains('payment-method-btn')) {
            const selectedValue = e.target.dataset.value;
            metodoPagamentoHidden.value = selectedValue;

            // Atualiza o estado visual dos botões
            paymentMethodGroup.querySelectorAll('.payment-method-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');

            // Mostra/esconde campos condicionais
            togglePaymentMethodFields(selectedValue);
            // Atualiza a prévia das parcelas
            calcularEExibirParcelasPreview(inputValorVenda, inputDescontoVenda, inputEntrada, inputParcelas, metodoPagamentoHidden);
        }
    });

    function togglePaymentMethodFields(metodo) {
        document.getElementById("container-parcelado-opcoes").classList.toggle("hidden", metodo !== "parcelado");
        document.getElementById("container-data-vencimento").classList.toggle("hidden", metodo !== "a_vista_deve");
    }

    btnDevedores.addEventListener("click", async () => {
        graficoDevedoresInstance = await abrirModalRelatorio(mainContainer, graficoDevedoresInstance, graficoDevedoresCanvas, totalGeralDevidoEl, vencimentosSummaryEl, relatorioConteudoEl, customSelectReportOptionsContainer);
        modalRelatorio.showModal();
    });

    btnFecharModalRelatorio.addEventListener("click", () => {
        modalRelatorio.close();
    });

    modalRelatorio.addEventListener("click", (event) => {
        if (event.target === modalRelatorio) {
            modalRelatorio.close();
        }
    });

    btnSettings.addEventListener('click', () => {
        const templateRelatorio = localStorage.getItem('templateRelatorio') || `Olá, {cliente}! 😊 Segue um resumo de suas pendências na Fique Bella:\n\n{pendencias}\n\n*Total a Receber: {total}*\n\nAgradecemos a sua atenção!`;
        const templateLembrete = localStorage.getItem('templateLembrete') || `Olá, {cliente}! 😊 Lembrete amigável da Fique Bella sobre suas pendências com vencimento próximo:\n\n{pendencias}\n\nAgradecemos a sua atenção!`;
        templateRelatorioTextarea.value = templateRelatorio;
        templateLembreteTextarea.value = templateLembrete;
        modalSettings.showModal();
    });

    btnFecharModalSettings.addEventListener('click', () => {
        modalSettings.close();
    });

    formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        localStorage.setItem('templateRelatorio', templateRelatorioTextarea.value);
        localStorage.setItem('templateLembrete', templateLembreteTextarea.value);
        alert('Configurações salvas com sucesso!');
        modalSettings.close();
    });

    btnGerarPdf.addEventListener("click", () => {
        const nomeCliente = selectClientePdfHidden.value;
        if (nomeCliente) {
            gerarPdfCliente(nomeCliente);
        }
    });

    btnEnviarWhatsappRelatorio.addEventListener("click", () => {
        const nomeCliente = selectClientePdfHidden.value;
        if (nomeCliente) {
            enviarRelatorioWhatsapp(nomeCliente);
        }
    });

    // NEW: Event listener para o botão de copiar relatório
    btnCopiarRelatorio.addEventListener("click", () => {
        const nomeCliente = selectClientePdfHidden.value;
        if (nomeCliente) {
            copiarTextoRelatorio(nomeCliente);
        }
    });

    btnLembreteVencimentos.addEventListener("click", () => {
        enviarLembretesVencimentosProximos();
    });

    btnExportarCsv.addEventListener("click", () => {
        exportarDadosCsv();
    });

    inputBuscaCliente.addEventListener('input', debounce(() => {
        filtrarClientes(inputBuscaCliente, vendasRegistradasLista);
    }, 300)); // 300ms de atraso para otimização

    // NEW: Event listener para a ordenação com botões
    sortMethodGroup.addEventListener('click', (e) => {
        if (e.target.classList.contains('sort-method-btn')) {
            const criterio = e.target.dataset.value;
            localStorage.setItem('fiqueBellaSortOrder', criterio);

            sortMethodGroup.querySelectorAll('.sort-method-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');

            ordenarClientes(criterio, vendasRegistradasLista);
        }
    });

    btnBackupDb.addEventListener('click', () => {
        handleBackup();
    });

    btnRestoreDb.addEventListener('click', () => {
        inputRestoreDb.click();
    });

    inputRestoreDb.addEventListener('change', (event) => {
        handleRestore(event);
    });

    btnLimparVendas.addEventListener('click', () => {
        limparFormularioVendas(formVendas, containerDataVencimento, containerParceladoOpcoes, selectCliente_venda);
    });

    inputValorVenda.addEventListener('input', (e) => { 
        formatCurrencyInput(e.target);
    });

    inputDescontoVenda.addEventListener('input', (e) => {
        formatCurrencyInput(e.target);
    });

    formCadastro.addEventListener("submit", (event) => handleFormCadastroSubmit(event, formCadastro, inputNome, inputTelefone, inputDataNascimento, inputEndereco, clientesLista, vendasRegistradasLista, customSelectOptionsContainer, customSelectReportOptionsContainer, totalGeralDevidoEl, vencimentosSummaryEl));

    formVendas.addEventListener("submit", (event) => handleFormVendasSubmit(event, formVendas, selectCliente_venda_hidden, inputProdutoVenda, inputValorVenda, inputDescontoVenda, metodoPagamentoHidden, inputObservacaoVenda, containerDataVencimento, selectDataVencimento, containerParceladoOpcoes, inputParcelas, inputEntrada, modalVendas));
});

async function solicitarPermissaoNotificacao() {
    if (!("Notification" in window)) {
        console.log("Este navegador não suporta notificações.");
        return;
    }

    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        const permissao = await Notification.requestPermission();
        if (permissao === "granted") {
            console.log("Permissão para notificações concedida.");
        } else {
            console.log("Permissão para notificações negada.");
        }
    }
}

async function verificarAniversariosDoDia() {
    await solicitarPermissaoNotificacao();

    if (Notification.permission !== "granted") {
        return; // Não pode enviar notificações se a permissão não foi dada
    }

    const aniversariantes = await dbService.getAniversariantesDoDia();
    if (aniversariantes.length > 0) {
        const corpoNotificacao = aniversariantes.length === 1
            ? `Hoje é aniversário de ${aniversariantes[0]}!`
            : `Hoje é aniversário de: ${aniversariantes.join(', ')}.`;

        new Notification('🎉 Aniversariantes do Dia!', {
            body: corpoNotificacao,
            icon: './icons/icon-192x192.png' // Ícone da notificação
        });
    }
}

async function verificarVencimentosDoDia() {
    await solicitarPermissaoNotificacao();

    if (Notification.permission !== "granted") {
        return;
    }

    const vencimentos = await dbService.getVencimentosDoDia();
    if (vencimentos.length > 0) {
        const total = vencimentos.reduce((acc, v) => acc + v.valor, 0);
        let corpoNotificacao;

        if (vencimentos.length === 1) {
            const v = vencimentos[0];
            corpoNotificacao = `${v.descricao} de ${v.cliente} no valor de ${formatCurrency(v.valor)} vence hoje.`;
        } else {
            corpoNotificacao = `Você tem ${vencimentos.length} pendências vencendo hoje, totalizando ${formatCurrency(total)}.`;
        }

        new Notification('🗓️ Vencimentos de Hoje!', {
            body: corpoNotificacao,
            icon: './icons/icon-192x192.png'
        });
    }
}
