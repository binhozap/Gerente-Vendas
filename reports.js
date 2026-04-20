
import { formatCurrency, formatCsvField } from './helpers.js';
import * as dbService from './database.js';
import { atualizarSelectClientes } from './ui.js';
export async function abrirModalRelatorio(mainContainer, graficoDevedoresInstance, graficoDevedoresCanvas, totalGeralDevidoEl, vencimentosSummaryEl, relatorioConteudoEl, reportOptionsContainer) {
    if (graficoDevedoresInstance) {
        graficoDevedoresInstance.destroy();
    }

    const resumoFinanceiro = await dbService.getFinancialSummary();
    const resumoContainer = document.getElementById('resumo-financeiro-geral');
    resumoContainer.innerHTML = `
        <div class="resumo-item">
            <span>Total Vendido</span>
            <strong>${formatCurrency(resumoFinanceiro.totalVendido)}</strong>
        </div>
        <div class="resumo-item">
            <span>Total Recebido</span>
            <strong>${formatCurrency(resumoFinanceiro.totalRecebido)}</strong>
        </div>
    `;

    relatorioConteudoEl.innerHTML = '';

    // Recalcula e exibe o total a receber e os vencimentos em vez de clonar
    const totalGeralDiv = document.createElement('div');
    totalGeralDiv.innerHTML = totalGeralDevidoEl.innerHTML;
    totalGeralDiv.id = totalGeralDevidoEl.id;
    totalGeralDiv.className = totalGeralDevidoEl.className;
    relatorioConteudoEl.appendChild(totalGeralDiv);

    const vencimentosDiv = document.createElement('div');
    vencimentosDiv.innerHTML = vencimentosSummaryEl.innerHTML;
    vencimentosDiv.id = vencimentosSummaryEl.id;
    vencimentosDiv.className = vencimentosSummaryEl.className;
    relatorioConteudoEl.appendChild(vencimentosDiv);

    // Re-adiciona a funcionalidade de toggle para a cópia dentro do modal
    const toggleButtonModal = vencimentosDiv.querySelector('.toggle-vencimentos');
    const contentDivModal = vencimentosDiv.querySelector('.vencimentos-content');

    if (toggleButtonModal && contentDivModal) {
        toggleButtonModal.addEventListener('click', () => {
            const isExpanded = toggleButtonModal.getAttribute('aria-expanded') === 'true';
            toggleButtonModal.setAttribute('aria-expanded', String(!isExpanded));
            contentDivModal.classList.toggle('expanded', !isExpanded);
        });
    }

    // Garante que os valores estejam zerados se não houver clientes
    const clientes = await dbService.getClientes();

    const devedores = [];
    let temDevedor = false;
    
    // Atualiza a lista de clientes devedores no novo select customizado
    await atualizarSelectClientes(null, reportOptionsContainer);

    document.querySelectorAll('.card-cliente.devedor').forEach(card => {
        const nomeCliente = card.dataset.cliente;
        const footerText = card.querySelector('.card-footer').textContent;
        const valor = parseFloat(footerText.replace('A Receber: R$ ', '').replace(/\./g, '').replace(',', '.'));
        
        if (!isNaN(valor) && valor > 0) {
            devedores.push({ nome: nomeCliente, valor: valor });
            temDevedor = true;
        }
    });

    const graficoContainer = document.querySelector('.grafico-container');
    const deveEsconderGrafico = !temDevedor || clientes.length === 0;
    graficoContainer.classList.toggle('hidden', deveEsconderGrafico);

    if (clientes.length === 0) return null;

    if (!temDevedor) return null;

    devedores.sort((a, b) => b.valor - a.valor);

    const labels = devedores.map(d => d.nome);
    const data = devedores.map(d => d.valor);
    
    const isLightTheme = mainContainer.classList.contains('light-theme');

    return new Chart(graficoDevedoresCanvas, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor a Receber',
                data: data,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)', 'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)'
                ],
                borderColor: isLightTheme ? '#fff' : '#1a1a1a',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: isLightTheme ? '#1c1e21' : '#f0f0f0' }
                }
            }
        }
    });
}

async function gerarTextoRelatorio(nomeCliente) {
    const cardCliente = document.querySelector(`.card-cliente[data-cliente="${nomeCliente}"]`);
    if (!cardCliente) return { texto: '', temDivida: false };

    let textoRelatorio = `Relatório de Pendências - Fique Bella\n`;
    textoRelatorio += `Cliente: ${nomeCliente}\n`;
    textoRelatorio += `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    textoRelatorio += `-------------------------------------------------\n\n`;

    const vendas = await dbService.getVendasPorCliente(nomeCliente);
    let pendenciasTexto = '';

    for (const venda of vendas) {
        const [id, produto, , valor, metodo, , , diasParaPagar, dataVenda, pago] = venda;
        if (pago) continue;

        let itemTexto = '';
        if (metodo === 'a_vista_deve') {
            const dataVencimento = new Date(dataVenda);
            dataVencimento.setDate(dataVencimento.getDate() + diasParaPagar);
            itemTexto += `▪️ ${produto} (${formatCurrency(valor)}) - Vence em: ${dataVencimento.toLocaleDateString('pt-BR')}\n`;
        } else if (metodo === 'parcelado') {
            const parcelas = await dbService.getParcelasPorVenda(id);
            const parcelasPendentes = parcelas.filter(p => !p[4]); // p[4] é 'paga'
            if (parcelasPendentes.length > 0) {
                itemTexto += `▪️ ${produto}:\n`;
                parcelasPendentes.forEach(p => {
                    const [, , pNum, pValor, , pVencimento] = p;
                    itemTexto += `  - Parcela ${pNum} (${formatCurrency(pValor)}) - Vence em: ${new Date(pVencimento).toLocaleDateString('pt-BR')}\n`;
                });
            }
        }
        pendenciasTexto += itemTexto;
    }

    const temDivida = pendenciasTexto.trim() !== '';
    if (temDivida) {
        textoRelatorio += pendenciasTexto;
    }
    
    const totalDevido = cardCliente.querySelector('.card-footer').textContent;
    textoRelatorio += `-------------------------------------------------\n\n`;
    textoRelatorio += `Valor Total a Receber: ${totalDevido.replace('A Receber: ', '')}\n`;

    return { texto: textoRelatorio, temDivida };
}

export async function copiarTextoRelatorio(nomeCliente) {
    const { texto, temDivida } = await gerarTextoRelatorio(nomeCliente);
    if (temDivida) {
        navigator.clipboard.writeText(texto).then(() => {
            alert('Texto do relatório copiado para a área de transferência!');
        }, (err) => {
            console.error('Erro ao copiar texto: ', err);
            alert('Não foi possível copiar o texto.');
        });
    } else {
        alert("Este cliente não possui dívidas pendentes para copiar.");
    }
}

export async function gerarPdfCliente(nomeCliente) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const { texto: textoRelatorio, temDivida } = await gerarTextoRelatorio(nomeCliente);

    if (temDivida) {
        doc.text(textoRelatorio, 10, 10);
        doc.save(`relatorio_${nomeCliente.replace(/\s/g, '_')}.pdf`);

        const enviarWhats = confirm("PDF gerado com sucesso!\nDeseja enviar o relatório para o cliente via WhatsApp?");
        if (enviarWhats) {
            enviarRelatorioWhatsapp(nomeCliente, textoRelatorio);
        }
    } else {
        alert("Este cliente não possui dívidas pendentes para gerar um relatório.");
    }
}

export async function enviarRelatorioWhatsapp(nomeCliente) {
    const clienteInfo = await dbService.getClientePorNome(nomeCliente);
    const telefone = clienteInfo ? clienteInfo.telefone : null;

    let url = `https://api.whatsapp.com/send?`;
    if (telefone) {
        url += `phone=55${telefone.replace(/\D/g, '')}&`;
    }

    const { texto: textoRelatorio, temDivida } = await gerarTextoRelatorio(nomeCliente);

    if (!temDivida) {
        alert("Este cliente não possui dívidas pendentes.");
        return;
    }

    url += `text=${encodeURIComponent(textoRelatorio)}`;
    window.open(url, '_blank');
}

export async function enviarLembretesVencimentosProximos() {
    const diasParaLembrete = 7;
    const hoje = new Date();
    const dataLimite = new Date();
    dataLimite.setDate(hoje.getDate() + diasParaLembrete);

    const clientes = await dbService.getClientes();
    const lembretesPorCliente = {};
    let totalLembretes = 0;

    for (const nomeCliente of clientes) {
        const vendas = await dbService.getVendasPorCliente(nomeCliente);
        for (const venda of vendas) {
            const [id, produto, quantidade, valor, metodo, , , diasParaPagar, dataVenda, pago] = venda;
            if (pago) continue;

            const prefixoProduto = quantidade > 1 ? `${quantidade}x ` : '';

            if (metodo === 'a_vista_deve') {
                const dataVencimento = new Date(dataVenda);
                dataVencimento.setDate(dataVencimento.getDate() + diasParaPagar);

                if (dataVencimento <= dataLimite && dataVencimento >= hoje) {
                    if (!lembretesPorCliente[nomeCliente]) lembretesPorCliente[nomeCliente] = [];
                    lembretesPorCliente[nomeCliente].push(`▪️ ${prefixoProduto}${produto} (${formatCurrency(valor)}) vence em ${dataVencimento.toLocaleDateString('pt-BR')}.`);
                    totalLembretes++;
                }
            } else if (metodo === 'parcelado') {
                const parcelas = await dbService.getParcelasPorVenda(id);
                for (const p of parcelas) {
                    const [, , pNum, pValor, pPaga, pVencimento] = p;
                    if (pPaga) continue;

                    const dataVencimentoParcela = new Date(pVencimento);
                    if (dataVencimentoParcela <= dataLimite && dataVencimentoParcela >= hoje) {
                        if (!lembretesPorCliente[nomeCliente]) lembretesPorCliente[nomeCliente] = [];
                        lembretesPorCliente[nomeCliente].push(`▪️ Parcela ${pNum} de ${prefixoProduto}${produto} (${formatCurrency(pValor)}) vence em ${dataVencimentoParcela.toLocaleDateString('pt-BR')}.`);
                        totalLembretes++;
                    }
                }
            }
        }
    }

    if (totalLembretes === 0) {
        alert("Nenhuma conta encontrada com vencimento nos próximos 7 dias.");
        return;
    }

    const confirmacao = confirm(`${totalLembretes} pendência(s) com vencimento próximo encontrada(s).\n\nDeseja enviar os lembretes via WhatsApp para os clientes?`);

    if (confirmacao) {
        for (const nomeCliente of Object.keys(lembretesPorCliente)) {
            const clienteInfo = await dbService.getClientePorNome(nomeCliente);
            const telefone = clienteInfo ? clienteInfo.telefone : null;

            const pendenciasTexto = lembretesPorCliente[nomeCliente].join('\n');

            const template = localStorage.getItem('templateLembrete') || `Olá, {cliente}! 😊 Lembrete amigável da Fique Bella sobre suas pendências com vencimento próximo:\n\n{pendencias}\n\nAgradecemos a sua atenção!`;
            let mensagem = template
                .replace('{cliente}', nomeCliente)
                .replace('{pendencias}', pendenciasTexto);

            let url = `https://api.whatsapp.com/send?`;
            if (telefone) {
                url += `phone=55${telefone.replace(/\D/g, '')}&`;
            }
            url += `text=${encodeURIComponent(mensagem)}`;
            window.open(url, '_blank');
        }
    }
}

export async function exportarDadosClienteCsv(nomeCliente) {
    const headers = [
        "Cliente", "Data Cadastro Cliente", "Telefone", "Data Nascimento", "Endereço",
        "ID Venda", "Produto", "Observacao", "Quantidade", 
        "Valor Total Venda", "Metodo Pagamento", "Data Venda", "Status Venda", 
        "Parcela Num", "Valor Parcela", "Status Parcela", "Data Vencimento Parcela", "Data Pagamento Parcela"
    ];

    let csvRows = [headers.map(formatCsvField).join(",")];

    try {
        const clienteInfo = await dbService.getClientePorNome(nomeCliente);
        if (!clienteInfo) {
            alert("Cliente não encontrado para exportação.");
            return;
        }

        const dataCadastroCliente = clienteInfo.data_cadastro ? new Date(clienteInfo.data_cadastro).toLocaleDateString('pt-BR') : '';
        const telefoneCliente = clienteInfo.telefone || '';
        const dataNascimentoCliente = clienteInfo.data_nascimento || '';
        const enderecoCliente = clienteInfo.endereco || '';

        const vendas = await dbService.getVendasPorCliente(nomeCliente);

        if (vendas.length === 0) {
            const row = [
                nomeCliente, dataCadastroCliente, telefoneCliente, dataNascimentoCliente, enderecoCliente, 
                'Nenhuma venda registrada', '', '', '', '', '', '', '', '', '', '', '', ''
            ].map(formatCsvField).join(",");
            csvRows.push(row);
        } else {
            for (const venda of vendas) {
                const [vendaId, produto, quantidade, valorTotal, metodo, , , , dataVenda, pago, observacao] = venda;
                const dataVendaFormatada = new Date(dataVenda).toLocaleDateString('pt-BR');
                const statusVenda = pago ? "Pago" : "Pendente";

                if (metodo !== 'parcelado') {
                    const rowData = [
                        nomeCliente, dataCadastroCliente, telefoneCliente, dataNascimentoCliente, enderecoCliente,
                        vendaId, produto, observacao || '', quantidade, valorTotal.toFixed(2), metodo, dataVendaFormatada, statusVenda, 
                        '', '', '', '', ''
                    ];
                    csvRows.push(rowData.map(formatCsvField).join(","));
                } else {
                    const parcelas = await dbService.getParcelasPorVenda(vendaId);
                    for (const p of parcelas) {
                        const [, , pNum, pValor, pPaga, pVencimento, pPagamento] = p;
                        const statusParcela = pPaga ? "Paga" : "Pendente";
                        const dataVencimentoFormatada = pVencimento ? new Date(pVencimento).toLocaleDateString('pt-BR') : "";
                        const dataPagamentoFormatada = pPagamento ? new Date(pPagamento).toLocaleDateString('pt-BR') : "";
                        
                        const rowData = [
                            nomeCliente, dataCadastroCliente, telefoneCliente, dataNascimentoCliente, enderecoCliente,
                            vendaId, produto, observacao || '', quantidade, valorTotal.toFixed(2), metodo, dataVendaFormatada, statusVenda, 
                            pNum, pValor.toFixed(2), statusParcela, dataVencimentoFormatada, dataPagamentoFormatada
                        ];
                        csvRows.push(rowData.map(formatCsvField).join(","));
                    }
                }
            }
        }

        downloadCsv(csvRows, `export_cliente_${nomeCliente.replace(/\s/g, '_')}.csv`);
    } catch (error) {
        console.error("Erro ao exportar dados do cliente para CSV:", error);
        alert("Ocorreu um erro ao exportar os dados. Verifique o console para mais detalhes.");
    }
}

export async function exportarDadosCsv() {
    const headers = [
        "Cliente", "Data Cadastro Cliente", "ID Venda", "Produto", "Observacao", "Quantidade", 
        "Valor Total Venda", "Metodo Pagamento", "Data Venda", "Status Venda", 
        "Parcela Num", "Valor Parcela", "Status Parcela", "Data Vencimento Parcela", "Data Pagamento Parcela"
    ];

    let csvRows = [headers.map(formatCsvField).join(",")];

    try {
        const clientes = await dbService.getClientes();

        for (const nomeCliente of clientes) {
            const clienteInfo = await dbService.getClientePorNome(nomeCliente);
            const dataCadastroCliente = clienteInfo.data_cadastro ? new Date(clienteInfo.data_cadastro).toLocaleDateString('pt-BR') : '';

            const vendas = await dbService.getVendasPorCliente(nomeCliente);

            if (vendas.length === 0) {
                const row = [
                    nomeCliente, dataCadastroCliente, '', '', '', '', '', '', '', '', '', '', '', '', ''
                ].map(formatCsvField).join(",");
                csvRows.push(row);
            } else {
                for (const venda of vendas) {
                    const [vendaId, produto, quantidade, valorTotal, metodo, , , , dataVenda, pago, observacao] = venda;
                    const dataVendaFormatada = new Date(dataVenda).toLocaleDateString('pt-BR');
                    const statusVenda = pago ? "Pago" : "Pendente";

                    if (metodo !== 'parcelado') {
                        const rowData = [
                            nomeCliente, dataCadastroCliente, vendaId, produto, observacao || '', quantidade, 
                            valorTotal.toFixed(2), metodo, dataVendaFormatada, statusVenda, 
                            '', '', '', '', ''
                        ];
                        csvRows.push(rowData.map(formatCsvField).join(","));
                    } else {
                        const parcelas = await dbService.getParcelasPorVenda(vendaId);
                        if (parcelas.length === 0) {
                            const rowData = [
                                nomeCliente, dataCadastroCliente, vendaId, produto, observacao || '', quantidade, 
                                valorTotal.toFixed(2), metodo, dataVendaFormatada, statusVenda, 
                                'N/A', '', 'N/A', '', ''
                            ];
                            csvRows.push(rowData.map(formatCsvField).join(","));
                        } else {
                            for (const p of parcelas) {
                                const [pId, , pNum, pValor, pPaga, pVencimento, pPagamento] = p;
                                const statusParcela = pPaga ? "Paga" : "Pendente";
                                const dataVencimentoFormatada = pVencimento ? new Date(pVencimento).toLocaleDateString('pt-BR') : "";
                                const dataPagamentoFormatada = pPagamento ? new Date(pPagamento).toLocaleDateString('pt-BR') : "";
                                
                                const rowData = [
                                    nomeCliente, dataCadastroCliente, vendaId, produto, observacao || '', quantidade, 
                                    valorTotal.toFixed(2), metodo, dataVendaFormatada, statusVenda, 
                                    pNum, pValor.toFixed(2), statusParcela, dataVencimentoFormatada, dataPagamentoFormatada
                                ];
                                csvRows.push(rowData.map(formatCsvField).join(","));
                            }
                        }
                    }
                }
            }
        }

        downloadCsv(csvRows, "fique_bella_export_geral.csv");
    } catch (error) {
        console.error("Erro ao exportar dados para CSV:", error);
        alert("Ocorreu um erro ao exportar os dados. Verifique o console para mais detalhes.");
    }
}

function downloadCsv(csvRows, filename) {
    const bom = "\uFEFF"; // Byte Order Mark para garantir a codificação correta em Excel
    const csvString = bom + csvRows.join("\r\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
