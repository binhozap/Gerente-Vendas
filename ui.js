import * as dbService from './database.js';

import { formatCurrency } from './helpers.js'; // A função já está aqui, mas vamos exportá-la implicitamente

let totalGeralDevidoEl;
let vencimentosSummaryEl;
let aniversariosSummaryEl;
let modalClienteDetalhesEl; // NEW
let clienteDetalhesNomeEl;
let clienteDetalhesInfoEl;
let clienteDetalhesVendasListaEl;
let parcelasPreviewEl; // NEW

export function initUI(totalGeralDevidoElement, vencimentosSummaryElement, aniversariosSummaryElement, modalClienteDetalhesElement, clienteDetalhesNomeElement, clienteDetalhesInfoElement, clienteDetalhesVendasListaElement, parcelasPreviewElement) { // Updated
    totalGeralDevidoEl = totalGeralDevidoElement;
    vencimentosSummaryEl = vencimentosSummaryElement;
    aniversariosSummaryEl = aniversariosSummaryElement;
    modalClienteDetalhesEl = modalClienteDetalhesElement; // NEW
    clienteDetalhesNomeEl = clienteDetalhesNomeElement; // NEW
    clienteDetalhesInfoEl = clienteDetalhesInfoElement; // NEW
    clienteDetalhesVendasListaEl = clienteDetalhesVendasListaElement; // NEW
    parcelasPreviewEl = parcelasPreviewElement; // NEW
}

export function applyTheme(theme, mainContainer) {
    mainContainer.classList.toggle('light-theme', theme === 'light');
}

export function adicionarClienteNaLista(nome, clientesLista, handleExcluirCliente) {
    const clienteItem = document.createElement("div");
    clienteItem.className = "cliente-item novo";
    clienteItem.dataset.nome = nome;
    clienteItem.innerHTML = `<span>${nome}</span><button class="btn-excluir">X</button>`;

    clienteItem.querySelector(".btn-excluir").addEventListener("click", (e) => handleExcluirCliente(nome, e.currentTarget.parentElement));
    clientesLista.appendChild(clienteItem);

    // Remove a classe de animação após a sua conclusão
    clienteItem.addEventListener('animationend', () => {
        clienteItem.classList.remove('novo');
    });
}

export async function criarCardCliente(nomeCliente, vendasRegistradasLista, handleExcluirCliente) { // Removed abrirModalParaEdicao from here
    const cliente = await dbService.getClientePorNome(nomeCliente);
    if (!cliente) return null;

    let dataCadastro;
    const telefone = cliente.telefone;
    const dataCadastroISO = cliente.data_cadastro;

    dataCadastro = dataCadastroISO ? new Date(dataCadastroISO).toLocaleDateString('pt-BR') : 'Data não registrada';

    let whatsappButtonHTML = '';
    if (telefone) {
        whatsappButtonHTML = `
            <a href="https://api.whatsapp.com/send?phone=55${telefone.replace(/\D/g, '')}" target="_blank" class="btn-whatsapp-card" title="Enviar mensagem no WhatsApp">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>
            </a>
        `;
    }

    const cardCliente = document.createElement("div");
    cardCliente.classList.add("card-cliente", "novo");
    cardCliente.dataset.cliente = nomeCliente;
    cardCliente.innerHTML = `
        <div class="card-header">
            <div>
                <h3 style="cursor: pointer;">${nomeCliente}</h3>
                <small>Cliente desde: ${dataCadastro}</small>
            </div>
            <div class="card-header-actions">
                ${whatsappButtonHTML}
                <button class="btn-excluir-card">X</button>
            </div>
        </div>
        <ol class="lista-compras"></ol>
        <div class="card-footer">A Receber: R$ 0,00</div>
    `;
    vendasRegistradasLista.appendChild(cardCliente);

    // Remove a classe de animação após a sua conclusão
    cardCliente.addEventListener('animationend', () => {
        cardCliente.classList.remove('novo');
    });

    const h3 = cardCliente.querySelector("h3");
    // NEW: Click no nome do cliente abre o modal de detalhes
    h3.addEventListener("click", () => abrirModalClienteDetalhes(nomeCliente));

    // Dblclick no nome do cliente para editar (mantido)
    h3.addEventListener("dblclick", async (e) => {
        e.stopPropagation(); // Evita que o click simples também seja disparado
        const antigoNome = h3.textContent;
        const originalH3 = h3; // Guarda a referência original
        const inputEdicao = document.createElement('input');
        inputEdicao.type = 'text';
        inputEdicao.value = antigoNome;
        inputEdicao.className = 'input-edicao-nome';

        h3.replaceWith(inputEdicao);
        inputEdicao.focus();

        const salvarEdicao = async () => {
            const novoNome = inputEdicao.value.trim();
            if (novoNome && novoNome !== antigoNome) {
                try {
                    await dbService.updateClienteNome(antigoNome, novoNome);
                    h3.textContent = novoNome;
                    atualizarNomeCliente(antigoNome, novoNome); // Atualiza todos os lugares
                    inputEdicao.replaceWith(originalH3); // Volta o h3 original
                } catch (e) {
                    alert("Já existe um cliente com este nome.");
                    inputEdicao.replaceWith(originalH3); // Volta o h3 original
                }
            } else {
                inputEdicao.replaceWith(originalH3); // Volta o h3 original
            }
        };

        inputEdicao.addEventListener('blur', salvarEdicao);
        inputEdicao.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                inputEdicao.blur();
            }
        });
    });

    cardCliente.querySelector(".btn-excluir-card").addEventListener("click", (e) => handleExcluirCliente(nomeCliente, cardCliente));

    return cardCliente;
}

export function atualizarNomeCliente(antigoNome, novoNome) {
    const cardCliente = document.querySelector(`.card-cliente[data-cliente="${antigoNome}"]`);
    if (cardCliente) {
        cardCliente.dataset.cliente = novoNome;
    }

    const clienteItemModal = document.querySelector(`.cliente-item[data-nome="${antigoNome}"]`);
    if (clienteItemModal) {
        clienteItemModal.dataset.nome = novoNome;
        clienteItemModal.querySelector('span').textContent = novoNome;
    }

    // A atualização dos selects ocorrerá na próxima vez que forem abertos.
}

export function ordenarClientes(criterio, vendasRegistradasLista) {
    const cards = Array.from(vendasRegistradasLista.querySelectorAll('.card-cliente'));

    cards.sort((a, b) => {
        if (criterio === 'maior_divida') {
            const valorA = parseFloat(a.querySelector('.card-footer').textContent.replace(/[^0-9,.-]+/g, "").replace('.', '').replace(',', '.')) || 0;
            const valorB = parseFloat(b.querySelector('.card-footer').textContent.replace(/[^0-9,.-]+/g, "").replace('.', '').replace(',', '.')) || 0;
            return valorB - valorA;
        } 
        // Padrão é 'alfabetica'
        else {
            const nomeA = a.dataset.cliente.toLowerCase();
            const nomeB = b.dataset.cliente.toLowerCase();
            if (nomeA < nomeB) return -1;
            if (nomeA > nomeB) return 1;
            return 0;
        }
    });

    // Limpa a lista antes de adicionar os cards ordenados
    // Preserva a mensagem de lista vazia se houver
    const mensagemVazia = vendasRegistradasLista.querySelector('.mensagem-lista-vazia');
    vendasRegistradasLista.innerHTML = '';
    if (mensagemVazia) {
        vendasRegistradasLista.appendChild(mensagemVazia);
    }

    cards.forEach(card => {
        vendasRegistradasLista.appendChild(card);
    });
}

export function filtrarClientes(inputBuscaCliente, vendasRegistradasLista) {
    const termoBusca = inputBuscaCliente.value.toLowerCase();
    const todosOsCards = vendasRegistradasLista.querySelectorAll('.card-cliente');

    todosOsCards.forEach(card => {
        const nomeCliente = card.dataset.cliente.toLowerCase();
        const visivel = nomeCliente.includes(termoBusca);
        card.classList.toggle('filtrado-fora', !visivel);
    });
    verificarListaClientesVazia(vendasRegistradasLista);
}

export function verificarListaClientesVazia(vendasRegistradasLista) {
    const todosOsCards = vendasRegistradasLista.querySelectorAll('.card-cliente');
    const cardsVisiveis = vendasRegistradasLista.querySelectorAll('.card-cliente:not(.filtrado-fora)');
    let mensagemVazia = vendasRegistradasLista.querySelector('.mensagem-lista-vazia');

    if (todosOsCards.length === 0) {
        if (!mensagemVazia) {
            mensagemVazia = document.createElement('div');
            mensagemVazia.className = 'mensagem-lista-vazia';
            vendasRegistradasLista.appendChild(mensagemVazia);
        }
        mensagemVazia.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"/></svg>
            <span>Nenhum cliente cadastrado.</span>
        `;
    } 
    else if (cardsVisiveis.length === 0) {
        if (!mensagemVazia) {
            mensagemVazia = document.createElement('div');
            mensagemVazia.className = 'mensagem-lista-vazia';
            vendasRegistradasLista.appendChild(mensagemVazia);
        }
        mensagemVazia.innerHTML = `<span>Nenhum cliente encontrado.</span>`;
    }
    else if (mensagemVazia) {
        mensagemVazia.remove();
    }
}

export async function renderVendasForCliente(targetListElement, nomeCliente, idItemAnimado = null, abrirModalParaEdicao) {
    targetListElement.innerHTML = ''; // Limpa a lista de vendas

    const vendas = await dbService.getVendasPorCliente(nomeCliente);

    for (const venda of vendas) {
        const [id, produto, quantidade, valor, metodo, entrada, numParcelas, diasParaPagar, dataVendaStr, pago, observacao, desconto] = venda;
        // Passa o targetListElement para adicionarVendaAoCard
        const parcelas = metodo === 'parcelado' ? await dbService.getParcelasPorVenda(id) : [];
        const dataVenda = new Date(dataVendaStr);
        adicionarVendaAoCard(targetListElement, nomeCliente, id, produto, quantidade, valor, metodo, entrada, numParcelas, diasParaPagar, dataVenda, pago, parcelas, observacao, desconto, abrirModalParaEdicao);
    }

    if (idItemAnimado) {
        const novoItem = targetListElement.querySelector(`li[data-venda-id="${idItemAnimado}"]`);
        if (novoItem) {
            novoItem.style.animation = 'fadeInSlideDown 0.7s ease-out';
            setTimeout(() => novoItem.style.animation = '', 700);
        }
    }
    // Atualiza o total devido no card principal, se aplicável
    const cardClientePrincipal = document.querySelector(`.card-cliente[data-cliente="${nomeCliente}"]`);
    if (cardClientePrincipal) {
        atualizarTotalDevido(cardClientePrincipal);
    }
}

export function adicionarVendaAoCard(targetListElement, nomeCliente, vendaId, produto, quantidade, valor, metodo, entrada, numParcelas, diasParaPagar, dataVendaObj, pago, parcelas = [], observacao = null, desconto = 0, abrirModalParaEdicao) {
    // Acha o card principal para atualizar o status devedor e o footer
    let cardCliente = document.querySelector(`.card-cliente[data-cliente="${nomeCliente}"]`);

    const compraItem = document.createElement("li");
    compraItem.dataset.vendaId = vendaId;
    compraItem.dataset.produto = produto;
    compraItem.dataset.valor = valor;
    const dataVenda = dataVendaObj.toLocaleDateString('pt-BR');

    const prefixoProduto = quantidade > 1 ? `${quantidade}x ` : '';

    let statusHTML = '';
    let detalhesExtraHTML = '';
    let parcelasHTML = '';

    if (pago) {
        statusHTML = `<span class="status pago">Pago</span>`;
    } else {
        cardCliente.classList.add("devedor");
        if (metodo === "a_vista_deve") {
            const dataVencimento = new Date(dataVendaObj); // Cria uma nova instância para evitar modificar a original
            dataVencimento.setHours(0, 0, 0, 0); // Zera a hora para comparação de datas

            dataVencimento.setDate(dataVendaObj.getDate() + diasParaPagar);
            const dataVencimentoFormatada = dataVencimento.toLocaleDateString('pt-BR');
            
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const estaVencido = dataVencimento < hoje;
            const classeStatus = estaVencido ? 'status a-prazo vencido' : 'status a-prazo';

            statusHTML = `<span class="${classeStatus}" data-id-venda="${vendaId}">
                    Pendente (Vence: ${dataVencimentoFormatada}) <button class="btn-pagar-pendente" aria-label="Marcar como pago">Pagar</button>
                </span>`;
        } else if (metodo === "parcelado" && numParcelas > 0) {
            let parcelasLis = "";
            let temParcelaPendente = false;
            parcelas.forEach(p => {
                const [pId, , pNum, pValor, pPaga, pVencimento] = p;
                const vencimentoFormatado = new Date(pVencimento).toLocaleDateString('pt-BR');

                const hoje = new Date(); // Cria uma nova instância para evitar modificar a original
                // Zera a hora para comparação de datas
                hoje.setHours(0, 0, 0, 0);
                const estaVencido = !pPaga && new Date(pVencimento) < hoje;
                const classeParcela = `parcela-item ${pPaga ? 'paga' : ''} ${estaVencido ? 'vencido' : ''}`;
                if (!pPaga) temParcelaPendente = true;

                parcelasLis += `
                    <li class="${classeParcela}" data-parcela-id="${pId}">
                        <input type="checkbox" id="p${pId}" ${pPaga ? 'checked' : ''} aria-label="Marcar parcela como paga">
                        <label for="p${pId}">Parcela ${pNum}/${numParcelas} - ${formatCurrency(pValor)} (Vence: ${vencimentoFormatado})</label>
                    </li>
                `;
            });
            parcelasHTML = `<ul class="lista-parcelas">${parcelasLis}</ul>`;
            if (temParcelaPendente) {
                statusHTML = `<span class="status a-prazo">Em aberto</span>`;
            } else {
                statusHTML = `<span class="status pago">Finalizado</span>`;
            }
        }
    }

    if (desconto > 0) {
        detalhesExtraHTML += `<div class="venda-detalhe"><span>Desconto:</span> <strong>-${formatCurrency(desconto)}</strong></div>`;
    }
    if (entrada > 0) {
        detalhesExtraHTML += `<div class="venda-detalhe"><span>Entrada:</span> <strong>${formatCurrency(entrada)}</strong></div>`;
    }
    if (observacao) {
        detalhesExtraHTML += `<div class="observacao-venda"><strong>Obs:</strong> ${observacao}</div>`;
    }

    const temDetalhesExtra = detalhesExtraHTML !== '';

    compraItem.innerHTML = `
        <div class="venda-grid">
            <div class="venda-produto">${prefixoProduto}${produto}</div>
            <div class="venda-data">${dataVenda}</div>
            <div class="venda-valor">${formatCurrency(valor)}</div>
            <div class="venda-acoes">
                ${temDetalhesExtra ? '<button class="btn-toggle-detalhes" title="Ver detalhes">...</button>' : ''}
                <button class="btn-excluir-compra" aria-label="Excluir compra" title="Excluir venda">x</button>
            </div>
            <div class="venda-status">${statusHTML}</div>
        </div>
        ${temDetalhesExtra ? `<div class="venda-detalhes-extra">${detalhesExtraHTML}</div>` : ''}
        ${parcelasHTML}
    `;

    targetListElement.appendChild(compraItem); // Adiciona ao elemento de lista passado como argumento

    if (temDetalhesExtra) {
        const toggleBtn = compraItem.querySelector('.btn-toggle-detalhes');
        const detalhesDiv = compraItem.querySelector('.venda-detalhes-extra');
        toggleBtn.addEventListener('click', () => detalhesDiv.classList.toggle('expanded'));
    }

    compraItem.addEventListener('dblclick', () => abrirModalParaEdicao(vendaId, nomeCliente));

    const btnPagarPendente = compraItem.querySelector('.btn-pagar-pendente');
    if (btnPagarPendente) {
        btnPagarPendente.addEventListener('click', (e) => {
            const spanStatus = e.target.closest('.status.a-prazo');
            marcarComoPago(spanStatus, cardCliente); // Passa o cardCliente para atualização
        });
    }

    compraItem.querySelector('.btn-excluir-compra').addEventListener('click', async () => {
        if (confirm(`Deseja excluir a compra do produto "${produto}"?`)) {
            await dbService.deleteVenda(vendaId);
            compraItem.remove();
            atualizarTotalDevido(cardCliente); // Atualiza o total do card principal
        }
    });

    compraItem.querySelectorAll('.parcela-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const parcelaItem = e.target.closest('.parcela-item');
            const parcelaId = parseInt(parcelaItem.dataset.parcelaId);
            parcelaItem.classList.toggle('paga', e.target.checked);
            adicionarDataPagamento(parcelaItem, e.target.checked);
            await dbService.updateParcelaStatus(parcelaId, e.target.checked ? 1 : 0, e.target.checked ? new Date().toISOString() : null);
            atualizarTotalDevido(cardCliente); // Atualiza o total do card principal
        });
    });

    atualizarTotalDevido(cardCliente); // Atualiza o total do card principal
    verificarStatusDevedor(cardCliente); // Atualiza o status devedor do card principal
}

export function verificarStatusDevedor(cardCliente) { // Recebe o cardCliente como parâmetro
    const temParcelaPendente = cardCliente.querySelector('.parcela-item input[type="checkbox"]:not(:checked)');
    const temPendenteUnico = cardCliente.querySelector('.btn-pagar-pendente');

    if (!temParcelaPendente && !temPendenteUnico) {
        cardCliente.classList.remove("devedor");
    } else {
        cardCliente.classList.add("devedor");
    }
}

export async function marcarComoPago(spanStatus, cardCliente) { // Recebe o cardCliente como parâmetro
    const vendaId = spanStatus.dataset.idVenda;
    if (!vendaId) return;

    await dbService.marcarVendaComoPaga(parseInt(vendaId));

    const dataPagamento = new Date().toLocaleDateString('pt-BR');
    spanStatus.innerHTML = `Pago em ${dataPagamento}`; // Atualiza o texto do status
    spanStatus.className = "status pago";
    verificarStatusDevedor(cardCliente);
    atualizarTotalDevido(cardCliente);
}

export function adicionarDataPagamento(parcelaItem, pago) {
    const dataAntiga = parcelaItem.querySelector('.data-pagamento');
    if (dataAntiga) dataAntiga.remove();

    if (pago) {
        const dataPagamento = new Date().toLocaleDateString('pt-BR');
        const spanData = document.createElement('span');
        spanData.className = 'data-pagamento';
        spanData.textContent = ` (pago em ${dataPagamento})`;
        parcelaItem.appendChild(spanData);
    }
}

export function atualizarTotalDevido(cardCliente) { // Recebe o cardCliente como parâmetro
    let total = 0;

    cardCliente.querySelectorAll('.lista-compras > li').forEach(compraItem => {
        const parcelasPendentesLabels = compraItem.querySelectorAll('.parcela-item:not(.paga) label');
        const pendenteUnico = compraItem.querySelector('.status.a-prazo .btn-pagar-pendente');

        if (parcelasPendentesLabels.length > 0) {
            parcelasPendentesLabels.forEach(label => {
                const texto = label.textContent;
                const valorParcela = parseFloat(texto.match(/R\$\s*([\d,]+)/)[1].replace(',', '.'));
                if (!isNaN(valorParcela)) {
                    total += valorParcela;
                }
            });
        } 
        else if (pendenteUnico) {
            const valorVenda = parseFloat(compraItem.dataset.valor);
            if (!isNaN(valorVenda)) {
                total += valorVenda;
            }
        }
    });

    const footer = cardCliente.querySelector('.card-footer');
    footer.textContent = `A Receber: ${formatCurrency(total)}`;
    atualizarVisaoGeralFinanceira(); // Atualiza a visão geral
    verificarStatusDevedor(cardCliente);
}

export function atualizarTotalGeralDevido() {
    let totalGeral = 0;
    const todosOsDevedores = document.querySelectorAll('.card-cliente.devedor');

    todosOsDevedores.forEach(card => {
        const footerText = card.querySelector('.card-footer').textContent;
        const valor = parseFloat(footerText.replace('A Receber: R$ ', '').replace(/\./g, '').replace(',', '.'));
        if (!isNaN(valor)) {
            totalGeral += valor;
        }
    });

    totalGeralDevidoEl.textContent = `Total a Receber: ${formatCurrency(totalGeral)}`;
    totalGeralDevidoEl.classList.toggle('hidden', totalGeral === 0);
}

export function atualizarVisaoGeralFinanceira() {
    atualizarTotalGeralDevido();
    atualizarResumoVencimentos();
}

function setupVencimentosToggle() {
    if (vencimentosSummaryEl.dataset.initialized) return;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'vencimentos-header';
    headerDiv.innerHTML = `
        <h3>Próximos Vencimentos</h3>
        <button class="toggle-vencimentos" aria-expanded="true" aria-label="Expandir/Colapsar Próximos Vencimentos">
            <svg class="icon-chevron-down" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>
            <svg class="icon-chevron-up" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/></svg>
        </button>
    `;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'vencimentos-content expanded';
    contentDiv.innerHTML = '<ul></ul>';

    vencimentosSummaryEl.appendChild(headerDiv);
    vencimentosSummaryEl.appendChild(contentDiv);

    const toggleButton = headerDiv.querySelector('.toggle-vencimentos');    
    // Faz todo o cabeçalho ser clicável para abrir/fechar
    headerDiv.addEventListener('click', () => {
        const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
        toggleButton.setAttribute('aria-expanded', String(!isExpanded));
        contentDiv.classList.toggle('expanded', !isExpanded);
    });

    // Adiciona um listener para fechar ao clicar fora
    document.addEventListener('click', (event) => {
        const isClickInside = vencimentosSummaryEl.contains(event.target);
        if (!isClickInside && contentDiv.classList.contains('expanded')) {
            toggleButton.setAttribute('aria-expanded', 'false');
            contentDiv.classList.remove('expanded');
        }
    });

    vencimentosSummaryEl.dataset.initialized = 'true';
}

export function atualizarResumoVencimentos() {
    const vencimentos = {};

    document.querySelectorAll('.card-cliente.devedor .lista-compras > li').forEach(compraItem => {
        const pendenteUnico = compraItem.querySelector('.status.a-prazo');
        if (pendenteUnico) {
            const textoStatus = pendenteUnico.textContent;
            const matchData = textoStatus.match(/Vence: ([\d\/]+)/);
            if (matchData) {
                const dataVencimento = matchData[1];
                const valor = parseFloat(compraItem.dataset.valor);
                if (!isNaN(valor)) {
                    vencimentos[dataVencimento] = (vencimentos[dataVencimento] || 0) + valor;
                }
            }
        }

        compraItem.querySelectorAll('.parcela-item:not(.paga) label').forEach(label => {
            const textoLabel = label.textContent;
            const matchData = textoLabel.match(/Vence: ([\d\/]+)/);
            const matchValor = textoLabel.match(/R\$ ([\d,]+)/);
            if (matchData && matchValor) {
                const dataVencimento = matchData[1];
                const valor = parseFloat(matchValor[1].replace(',', '.'));
                if (!isNaN(valor)) {
                    vencimentos[dataVencimento] = (vencimentos[dataVencimento] || 0) + valor;
                }
            }
        });
    });

    setupVencimentosToggle();

    const ul = vencimentosSummaryEl.querySelector('.vencimentos-content ul');
    ul.innerHTML = '';

    const datas = Object.keys(vencimentos).sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));

    if (datas.length > 0) {
        datas.forEach(data => {
            const li = document.createElement('li');
            li.innerHTML = `${data}: <strong>${formatCurrency(vencimentos[data])}</strong>`;
            ul.appendChild(li);
        });
        vencimentosSummaryEl.classList.remove('hidden');
    } else {
        vencimentosSummaryEl.classList.add('hidden');
    }
}

// NEW: Função para calcular e exibir a prévia das parcelas no modal de vendas
export function calcularEExibirParcelasPreview(inputValorVenda, inputDescontoVenda, inputEntrada, inputParcelas, metodoPagamentoHidden) {
    const metodo = metodoPagamentoHidden.value;
    parcelasPreviewEl.innerHTML = ''; // Limpa a prévia anterior

    if (metodo !== 'parcelado') {
        parcelasPreviewEl.classList.add('hidden');
        return;
    }

    const valorFormatado = inputValorVenda.value;
    const valorTotal = parseFloat(valorFormatado.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

    const descontoFormatado = inputDescontoVenda.value;
    const desconto = parseFloat(descontoFormatado.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

    const entrada = parseFloat(inputEntrada.value) || 0;
    const numParcelas = parseInt(inputParcelas.value) || 0;

    if (isNaN(valorTotal) || valorTotal <= 0 || isNaN(numParcelas) || numParcelas <= 0) {
        parcelasPreviewEl.classList.add('hidden');
        return;
    }

    const valorFinal = valorTotal - desconto;
    const valorAParcelar = valorFinal - entrada;

    if (valorAParcelar <= 0) {
        parcelasPreviewEl.innerHTML = `<p class="info-preview">Valor a parcelar é zero ou negativo. Não há parcelas.</p>`;
        parcelasPreviewEl.classList.remove('hidden');
        return;
    }

    const valorParcelaPadrao = parseFloat((valorAParcelar / numParcelas).toFixed(2));
    const totalArredondado = valorParcelaPadrao * numParcelas;
    const diferenca = parseFloat((valorAParcelar - totalArredondado).toFixed(2));

    let previewHTML = '<p class="info-preview">Prévia das Parcelas:</p><ul class="parcelas-preview-list">';
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    for (let i = 1; i <= numParcelas; i++) {
        let valorParcelaCorrente = valorParcelaPadrao;
        if (i === numParcelas) {
            valorParcelaCorrente = parseFloat((valorParcelaCorrente + diferenca).toFixed(2));
        }
        const dataVencimentoParcela = new Date(hoje);
        dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i);
        const vencimentoFormatado = dataVencimentoParcela.toLocaleDateString('pt-BR');

        previewHTML += `<li>Parcela ${i}/${numParcelas}: ${formatCurrency(valorParcelaCorrente)} (Vence: ${vencimentoFormatado})</li>`;
    }
    previewHTML += '</ul>';

    parcelasPreviewEl.innerHTML = previewHTML;
    parcelasPreviewEl.classList.remove('hidden');
}

export function limparFormularioVendas(formVendas, containerDataVencimento, containerParceladoOpcoes) {
    const modalVendas = document.getElementById('modal-vendas');
    formVendas.querySelector('.btn-secundario').classList.remove('hidden');
    formVendas.reset();

    // Reseta o seletor de cliente customizado
    document.getElementById('select-cliente-venda-input').value = '';
    document.getElementById('select-cliente-venda-hidden').value = '';
    document.getElementById('select-cliente-venda-input').readOnly = false;

    // Reseta o seletor de método de pagamento
    const paymentMethodGroup = formVendas.querySelector('.payment-method-group');
    paymentMethodGroup.querySelectorAll('.payment-method-btn').forEach(btn => btn.classList.remove('active'));
    paymentMethodGroup.querySelector('.payment-method-btn[data-value="a_vista_pago"]').classList.add('active');
    document.getElementById('metodo-pagamento-hidden').value = 'a_vista_pago';

    containerDataVencimento.classList.add("hidden");
    containerParceladoOpcoes.classList.add("hidden");
    parcelasPreviewEl.classList.add('hidden'); // NEW: Limpa a prévia das parcelas

    delete formVendas.dataset.editingId;
    modalVendas.querySelector('h2').textContent = 'Registrar Venda';
}

// NEW: Função para abrir o modal de detalhes do cliente
export async function abrirModalClienteDetalhes(nomeCliente) {
    const cliente = await dbService.getClientePorNome(nomeCliente);
    if (!cliente) {
        alert("Cliente não encontrado.");
        return;
    }

    modalClienteDetalhesEl.dataset.clienteAtual = nomeCliente; // Armazena o nome do cliente no modal
    clienteDetalhesNomeEl.textContent = nomeCliente;

    let infoHTML = '';
    if (cliente.telefone) {
        infoHTML += `<p>Telefone: <a href="tel:${cliente.telefone}">${cliente.telefone}</a></p>`;
    }
    if (cliente.data_nascimento) {
        const dataNascimentoFormatada = new Date(cliente.data_nascimento).toLocaleDateString('pt-BR');
        infoHTML += `<p>Nascimento: ${dataNascimentoFormatada}</p>`;
    }
    if (cliente.data_cadastro) {
        const dataCadastroFormatada = new Date(cliente.data_cadastro).toLocaleDateString('pt-BR');
        infoHTML += `<p>Cliente desde: ${dataCadastroFormatada}</p>`;
    }
    if (cliente.endereco) {
        infoHTML += `<p>Endereço: ${cliente.endereco}</p>`;
    }
    clienteDetalhesInfoEl.innerHTML = infoHTML;

    // Renderiza as vendas do cliente no modal
    await renderVendasForCliente(clienteDetalhesVendasListaEl, nomeCliente, null, (vendaId, nome) => abrirModalParaEdicao(vendaId, nome, formVendas, inputProdutoVenda, inputValorVenda, inputDescontoVenda, selectMetodoPagamento, inputEntrada, inputParcelas, selectDataVencimento, inputObservacaoVenda, containerParceladoOpcoes, containerDataVencimento, modalVendas));

    modalClienteDetalhesEl.showModal();
}

// Função para atualizar o resumo de aniversários
export async function atualizarLembretesAniversario() {
    const aniversariantes = await dbService.getAniversariantesProximos();

    aniversariosSummaryEl.innerHTML = ''; // Clear existing content

    if (aniversariantes.length > 0) {
        // Create the header and toggle button
        const headerDiv = document.createElement('div');
        headerDiv.className = 'aniversarios-header';
        // O ícone de seta para baixo deve ser o padrão quando expandido
        headerDiv.innerHTML = `
            <h3>Próximos Aniversários</h3>
            <button class="toggle-aniversarios" aria-expanded="true" aria-label="Expandir/Colapsar Próximos Aniversários">
                <svg class="icon-chevron-down" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <!-- Ícone para quando está expandido -->
                    <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/> 
                </svg>
                <svg class="icon-chevron-up" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <!-- Ícone para quando está recolhido -->
                    <path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/> 
                </svg>
            </button>
        `;
        aniversariosSummaryEl.appendChild(headerDiv);

        // Create the content div and the list
        const contentDiv = document.createElement('div');
        contentDiv.className = 'aniversarios-content expanded'; // Começa expandido por padrão
        const ul = document.createElement('ul');

        aniversariantes.forEach(aniversariante => {
            const dataAniversario = aniversariante.data; // Já é um objeto Date
            const hoje = new Date();
            hoje.setHours(0,0,0,0);

            const isToday = dataAniversario.getDate() === hoje.getDate() && dataAniversario.getMonth() === hoje.getMonth();
            const textoData = isToday ? 'Hoje! 🎉' : dataAniversario.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            const li = document.createElement('li');
            li.innerHTML = `${aniversariante.nome}: <strong>${textoData}</strong>`;
            ul.appendChild(li);
        });
        contentDiv.appendChild(ul);
        aniversariosSummaryEl.appendChild(contentDiv);

        // Add event listener for toggling
        const toggleButton = headerDiv.querySelector('.toggle-aniversarios');
        toggleButton.addEventListener('click', () => {
            const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
            toggleButton.setAttribute('aria-expanded', !isExpanded);
            contentDiv.classList.toggle('expanded', !isExpanded);
        });

        aniversariosSummaryEl.classList.remove('hidden');
    } else {
        aniversariosSummaryEl.classList.add('hidden');
    }
}

export async function atualizarSelectClientes(salesOptionsContainer, reportOptionsContainer) {
    const clientes = await dbService.getClientes();

    // Popula o select customizado de vendas
    if (salesOptionsContainer) {
        salesOptionsContainer.innerHTML = '';
        clientes.forEach(nomeCliente => {
            const optionDiv = document.createElement("div");
            optionDiv.className = 'custom-select-option';
            optionDiv.textContent = nomeCliente;
            optionDiv.dataset.value = nomeCliente;
            salesOptionsContainer.appendChild(optionDiv);
        });
    }

    // Popula o select padrão de relatórios
    if (reportOptionsContainer) {
        reportOptionsContainer.innerHTML = '';
        clientes.forEach(nomeCliente => {
            const card = document.querySelector(`.card-cliente[data-cliente="${nomeCliente}"]`);
            if (card && card.classList.contains('devedor')) {
                const optionDiv = document.createElement("div");
                optionDiv.className = 'custom-select-option';
                optionDiv.textContent = nomeCliente;
                optionDiv.dataset.value = nomeCliente;
                reportOptionsContainer.appendChild(optionDiv);
            }
        });
    }
}