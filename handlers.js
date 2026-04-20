
import * as dbService from './database.js';
import {
    adicionarClienteNaLista,
    criarCardCliente,
    verificarListaClientesVazia,
    renderVendasForCliente,
    atualizarSelectClientes,
    atualizarVisaoGeralFinanceira,
    limparFormularioVendas
} from './ui.js';
import { formatCurrencyInput } from './helpers.js';
export async function handleFormCadastroSubmit(event, formCadastro, inputNome, inputTelefone, inputDataNascimento, inputEndereco, clientesLista, vendasRegistradasLista, salesOptionsContainer, reportOptionsContainer, totalGeralDevidoEl, vencimentosSummaryEl) {
    event.preventDefault();
    const submitButton = formCadastro.querySelector('button[type="submit"]');
    const nomeCliente = inputNome.value.trim();
    const telefoneCliente = inputTelefone.value.trim();
    const dataNascimentoCliente = inputDataNascimento.value; // NEW
    const enderecoCliente = inputEndereco.value.trim(); // NEW

    if (nomeCliente) {
        submitButton.classList.add('loading');
        try {
            await dbService.addCliente(nomeCliente, telefoneCliente, dataNascimentoCliente, enderecoCliente);

            const excluirCallback = (nome, el) => handleExcluirCliente(nome, el, vendasRegistradasLista, salesOptionsContainer, reportOptionsContainer, totalGeralDevidoEl, vencimentosSummaryEl);

            adicionarClienteNaLista(nomeCliente, clientesLista, excluirCallback);
            await criarCardCliente(nomeCliente, vendasRegistradasLista, excluirCallback);

            verificarListaClientesVazia(vendasRegistradasLista);
            inputNome.value = "";
            inputDataNascimento.value = ""; // NEW
            inputEndereco.value = ""; // NEW
            inputTelefone.value = "";
            inputNome.focus();
        } catch (e) {
            console.error("Erro detalhado ao cadastrar cliente:", e);
            if (e.message.includes("UNIQUE constraint failed")) {
                alert("Já existe um cliente com este nome.");
            } else {
                alert(`Ocorreu um erro ao cadastrar o cliente. Detalhes: ${e.message}`);
            }
        } finally {
            submitButton.classList.remove('loading');
        }
    }
}

export async function handleExcluirCliente(nomeCliente, elemento, vendasRegistradasLista, salesOptionsContainer, reportOptionsContainer, totalGeralDevidoEl, vencimentosSummaryEl) {
    if (confirm(`Tem certeza que deseja excluir ${nomeCliente} e todas as suas vendas?`)) {
        try {
            // Remove o card do cliente da tela principal
            const cardCliente = document.querySelector(`.card-cliente[data-cliente="${nomeCliente}"]`);
            if (cardCliente) { // Adiciona animação de remoção
                cardCliente.classList.add('removendo');
                cardCliente.addEventListener('animationend', () => cardCliente.remove());
            }

            // Remove o item do cliente da lista no modal de cadastro
            const itemClienteModal = document.querySelector(`#modal-cadastro .cliente-item[data-nome="${nomeCliente}"]`);
            if (itemClienteModal) {
                itemClienteModal.classList.add('removendo'); // Adiciona animação de remoção
                itemClienteModal.addEventListener('transitionend', () => itemClienteModal.remove());
            }

            // Aguarda a animação antes de atualizar a UI, ou deleta do DB e atualiza a UI
            await dbService.deleteCliente(nomeCliente);

            atualizarSelectClientes(salesOptionsContainer, reportOptionsContainer);
            atualizarVisaoGeralFinanceira(totalGeralDevidoEl, vencimentosSummaryEl);
            verificarListaClientesVazia(vendasRegistradasLista);
        } catch (e) { console.error("Erro ao excluir cliente:", e); }
    }
}

export async function handleFormVendasSubmit(event, formVendas, selectCliente_venda, inputProdutoVenda, inputValorVenda, inputDescontoVenda, selectMetodoPagamento, inputObservacaoVenda, containerDataVencimento, selectDataVencimento, containerParceladoOpcoes, inputParcelas, inputEntrada, modalVendas) {
    event.preventDefault();
    const submitButton = formVendas.querySelector('button[type="submit"]');

    const cliente = selectCliente_venda.value;
    const produto = inputProdutoVenda.value.trim();
    const quantidade = parseInt(document.getElementById('input-quantidade-venda').value) || 1;
    const valorFormatado = inputValorVenda.value;
    const valorUnitario = parseFloat(valorFormatado.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

    const descontoFormatado = inputDescontoVenda.value;
    const desconto = parseFloat(descontoFormatado.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

    const metodo = selectMetodoPagamento.value;
    const diasParaPagar = parseInt(selectDataVencimento.value);
    const entrada = parseFloat(inputEntrada.value) || 0;
    const numParcelas = parseInt(inputParcelas.value) || 0;
    const observacao = inputObservacaoVenda.value.trim();

    const vendaIdParaEditar = formVendas.dataset.editingId ? parseInt(formVendas.dataset.editingId) : null;

    if (cliente && produto && !isNaN(valorUnitario) && valorUnitario > 0) {
        submitButton.classList.add('loading');

        const dadosVenda = {
            cliente, produto, quantidade, valorUnitario, desconto, metodo, diasParaPagar, entrada, numParcelas, observacao
        };

        try {
            if (vendaIdParaEditar) {
                await dbService.updateVenda(vendaIdParaEditar, dadosVenda);
                // CORREÇÃO: Passa a lista de compras dentro do card, e não o card inteiro.
                const cardCliente = document.querySelector(`.card-cliente[data-cliente="${cliente}"]`);
                if (cardCliente) {
                    const listaComprasEl = cardCliente.querySelector('.lista-compras');
                    await renderVendasForCliente(listaComprasEl, cliente, vendaIdParaEditar);
                }
            } else {
                const novaVendaId = await dbService.addVenda(dadosVenda);
                // CORREÇÃO: Passa a lista de compras dentro do card, e não o card inteiro.
                const cardCliente = document.querySelector(`.card-cliente[data-cliente="${cliente}"]`);
                if (cardCliente) {
                    const listaComprasEl = cardCliente.querySelector('.lista-compras');
                    await renderVendasForCliente(listaComprasEl, cliente, novaVendaId);
                }
            }

            limparFormularioVendas(formVendas, containerDataVencimento, containerParceladoOpcoes, selectCliente_venda);
            modalVendas.close();

        } catch (e) {
            console.error("Erro ao salvar venda:", e);
            alert("Ocorreu um erro ao salvar a venda.");
        } finally {
            submitButton.classList.remove('loading');
            modalVendas.querySelector('h2').textContent = 'Registrar Venda';
            selectCliente_venda.disabled = false;
        }
    }
}

export async function abrirModalParaEdicao(vendaId, nomeCliente, formVendas, selectCliente_venda_input, selectCliente_venda_hidden, inputProdutoVenda, inputValorVenda, inputDescontoVenda, paymentMethodGroup, metodoPagamentoHidden, inputEntrada, inputParcelas, selectDataVencimento, inputObservacaoVenda, containerParceladoOpcoes, containerDataVencimento, modalVendas) {
    const vendas = await dbService.getVendasPorCliente(nomeCliente);
    const venda = vendas.find(v => v[0] === vendaId);

    if (!venda) {
        alert("Venda não encontrada para edição.");
        return;
    }

    const [id, produto, quantidade, valor, metodo, entrada, numParcelas, diasParaPagar, , pago, observacao, desconto] = venda;

    if (pago) {
        alert("Não é possível editar uma venda que já foi totalmente paga.");
        return;
    }

    formVendas.dataset.editingId = id;
    selectCliente_venda_input.value = nomeCliente;
    selectCliente_venda_hidden.value = nomeCliente;
    selectCliente_venda_input.readOnly = true; // Impede a edição direta, mas permite o clique
    inputProdutoVenda.value = produto;
    document.getElementById('input-quantidade-venda').value = quantidade;
    const valorUnitario = (valor + (desconto || 0)) / quantidade;
    formatCurrencyInput(inputValorVenda, valorUnitario * 100);
    formatCurrencyInput(inputDescontoVenda, (desconto || 0) * 100);
    
    // Atualiza o seletor de método de pagamento customizado
    metodoPagamentoHidden.value = metodo;
    paymentMethodGroup.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === metodo);
    });

    inputEntrada.value = entrada || '';
    inputParcelas.value = numParcelas || '';
    selectDataVencimento.value = diasParaPagar || '15';
    inputObservacaoVenda.value = observacao || '';

    containerParceladoOpcoes.classList.toggle("hidden", metodo !== "parcelado");
    containerDataVencimento.classList.toggle("hidden", metodo !== "a_vista_deve");

    modalVendas.querySelector('h2').textContent = 'Editar Venda';
    // O texto do botão é atualizado pela classe 'loading'
    formVendas.querySelector('.btn-secundario').classList.add('hidden');
    modalVendas.showModal();
}
 
export function handleBackup() {
    try {
        const data = dbService.getDbFile();
        const blob = new Blob([data], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const date = new Date();
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        link.setAttribute("href", url);
        link.setAttribute("download", `backup_fique_bella_${dateString}.db`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("Backup gerado com sucesso!");
    } catch (error) {
        console.error("Erro ao gerar backup:", error);
        alert("Ocorreu um erro ao gerar o backup.");
    }
}

export function handleRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (confirm("ATENÇÃO: Restaurar um backup substituirá TODOS os dados atuais. Esta ação não pode ser desfeita. Deseja continuar?")) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            await dbService.restoreDb(new Uint8Array(e.target.result));
            alert("Backup restaurado com sucesso! A aplicação será reiniciada.");
            location.reload();
        };
        reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
}
