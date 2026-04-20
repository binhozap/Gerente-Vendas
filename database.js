let db;

// ==================================================
// HELPER FUNCTIONS FOR INDEXEDDB
// ==================================================
const idbName = "FiqueBellaAppDB";
const storeName = "sqliteDBStore";
const dbKey = "dbFile";

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(idbName, 1);
        request.onerror = (event) => reject("Erro ao abrir IndexedDB: " + event.target.errorCode);
        request.onsuccess = (event) => resolve(event.target.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName);
            }
        };
    });
}

async function getFromIndexedDB() {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(dbKey);
        request.onerror = (event) => reject("Erro ao ler do IndexedDB: " + event.target.errorCode);
        request.onsuccess = (event) => resolve(event.target.result);
    });
}

async function saveToIndexedDB(data) {
    const db = await openIndexedDB();
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    store.put(data, dbKey);
    return new Promise(resolve => transaction.oncomplete = resolve);
}

export async function initDB(onReadyCallback) {
    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`
        });

        const savedDb = await getFromIndexedDB();
        if (savedDb) {
            db = new SQL.Database(savedDb);
            console.log("Banco de dados carregado do IndexedDB.");
        } else {
            db = new SQL.Database();
            console.log("Novo banco de dados criado.");
            const query = `
                CREATE TABLE clientes (                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT UNIQUE,
                    telefone TEXT,
                    data_cadastro TEXT,
                    data_nascimento TEXT,
                    endereco TEXT
                );
                CREATE TABLE vendas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cliente_id INTEGER,
                    produto TEXT,
                    observacao TEXT,
                    quantidade INTEGER DEFAULT 1,
                    desconto REAL DEFAULT 0,
                    valor REAL,
                    metodo TEXT,
                    entrada REAL,
                    num_parcelas INTEGER,
                    dias_para_pagar INTEGER,
                    data_venda TEXT,
                    pago INTEGER DEFAULT 0,
                    data_pagamento TEXT,
                    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
                );
                CREATE TABLE parcelas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    venda_id INTEGER,
                    numero_parcela INTEGER,
                    valor_parcela REAL,
                    paga INTEGER DEFAULT 0,
                    data_vencimento TEXT,
                    data_pagamento TEXT,
                    FOREIGN KEY (venda_id) REFERENCES vendas (id)
                );
            `;
            db.run(query);
            await saveDB();
        }

        const vendasTableInfo = db.exec("PRAGMA table_info(vendas);");
        const vendasColumns = vendasTableInfo[0].values.map(col => col[1]);
        if (!vendasColumns.includes('observacao')) {
            console.log("Executando migração: Adicionando coluna 'observacao' à tabela 'vendas'.");
            db.run("ALTER TABLE vendas ADD COLUMN observacao TEXT;");
            await saveDB();
        }
        if (!vendasColumns.includes('data_pagamento')) {
            console.log("Executando migração: Adicionando coluna 'data_pagamento' à tabela 'vendas'.");
            db.run("ALTER TABLE vendas ADD COLUMN data_pagamento TEXT;");
            await saveDB();
        }

        const clientesTableInfo = db.exec("PRAGMA table_info(clientes);");
        const clientesColumns = clientesTableInfo[0].values.map(col => col[1]);
        if (!clientesColumns.includes('telefone')) {
            console.log("Executando migração: Adicionando coluna 'telefone' à tabela 'clientes'.");
            db.run("ALTER TABLE clientes ADD COLUMN telefone TEXT;");
            await saveDB();
        }

        if (!vendasColumns.includes('desconto')) {
            console.log("Executando migração: Adicionando coluna 'desconto' à tabela 'vendas'.");
            db.run("ALTER TABLE vendas ADD COLUMN desconto REAL DEFAULT 0;");
            await saveDB();
        }

        if (!clientesColumns.includes('data_nascimento')) {
            console.log("Executando migração: Adicionando coluna 'data_nascimento' à tabela 'clientes'.");
            db.run("ALTER TABLE clientes ADD COLUMN data_nascimento TEXT;");
            await saveDB();
        }

        if (!clientesColumns.includes('endereco')) {
            console.log("Executando migração: Adicionando coluna 'endereco' à tabela 'clientes'.");
            db.run("ALTER TABLE clientes ADD COLUMN endereco TEXT;");
            await saveDB();
        }

        if (onReadyCallback) onReadyCallback();
    } catch (err) {
        console.error("Erro ao inicializar o banco de dados:", err);
    }
}

async function saveDB() {
    try {
        const data = db.export();
        await saveToIndexedDB(data);
        console.log("Banco de dados salvo no IndexedDB.");
    } catch (err) {
        console.error("Erro ao salvar o banco de dados:", err);
    }
}

export function getClientes() {
    const res = db.exec("SELECT nome FROM clientes ORDER BY nome");
    return res.length > 0 ? res[0].values.flat() : [];
}

export function getClientePorNome(nome) {
    const stmt = db.prepare("SELECT * FROM clientes WHERE nome = :nome");
    const result = stmt.getAsObject({ ':nome': nome });
    stmt.free();
    if (result && result.id !== undefined) {
        return result;
    }
    return null;
}

export function getVendasPorCliente(nomeCliente) {
    const query = `
        SELECT v.id, v.produto, v.quantidade, v.valor, v.metodo, v.entrada, v.num_parcelas, v.dias_para_pagar, v.data_venda, v.pago, v.observacao, v.desconto
        FROM vendas v
        JOIN clientes c ON v.cliente_id = c.id
        WHERE c.nome = ?
    `;
    const res = db.exec(query, [nomeCliente]);
    return res.length > 0 ? res[0].values : [];
}

export function getParcelasPorVenda(vendaId) {
    const query = `SELECT id, venda_id, numero_parcela, valor_parcela, paga, data_vencimento, data_pagamento FROM parcelas WHERE venda_id = ? ORDER BY numero_parcela`;
    const res = db.exec(query, [vendaId]);
    return res.length > 0 ? res[0].values : [];
}

export function getFinancialSummary() {
    let totalVendido = 0;
    let totalRecebido = 0;

    const resVendido = db.exec("SELECT SUM(valor) FROM vendas");
    if (resVendido.length > 0 && resVendido[0].values[0][0] !== null) {
        totalVendido = Number(resVendido[0].values[0][0]) || 0;
    }

    const resRecebidoDireto = db.exec("SELECT SUM(valor) FROM vendas WHERE pago = 1 AND metodo = 'a_vista_pago'");
    if (resRecebidoDireto.length > 0 && resRecebidoDireto[0].values[0][0] !== null) {
        totalRecebido += Number(resRecebidoDireto[0].values[0][0]) || 0;
    }

    const resEntradas = db.exec("SELECT SUM(entrada) FROM vendas WHERE metodo = 'parcelado' AND entrada > 0");
    if (resEntradas.length > 0 && resEntradas[0].values[0][0] !== null) {
        totalRecebido += Number(resEntradas[0].values[0][0]) || 0;
    }

    const resParcelasPagas = db.exec("SELECT SUM(valor_parcela) FROM parcelas WHERE paga = 1");
    if (resParcelasPagas.length > 0 && resParcelasPagas[0].values[0][0] !== null) {
        totalRecebido += Number(resParcelasPagas[0].values[0][0]) || 0;
    }

    // Adiciona o valor total de vendas 'a_vista_deve' que foram marcadas como pagas
    const resAVistaPagoDepois = db.exec("SELECT SUM(valor) FROM vendas WHERE pago = 1 AND metodo = 'a_vista_deve'");
    if (resAVistaPagoDepois.length > 0 && resAVistaPagoDepois[0].values[0][0] !== null) {
        totalRecebido += Number(resAVistaPagoDepois[0].values[0][0]) || 0;
    }

    return { totalVendido, totalRecebido };
}

export function getMonthlyFinancialSummary(year, month) {
    const anoMes = `${year}-${String(month).padStart(2, '0')}`;
    let totalVendidoMes = 0;
    let totalRecebidoMes = 0;

    // Total vendido no mês
    const resVendido = db.exec("SELECT SUM(valor) FROM vendas WHERE strftime('%Y-%m', data_venda) = ?", [anoMes]);
    if (resVendido.length > 0 && resVendido[0].values[0][0] !== null) {
        totalVendidoMes = Number(resVendido[0].values[0][0]);
    }

    // Recebimentos de vendas à vista pagas no mês
    const resAVistaPago = db.exec("SELECT SUM(valor) FROM vendas WHERE metodo = 'a_vista_pago' AND strftime('%Y-%m', data_venda) = ?", [anoMes]);
    if (resAVistaPago.length > 0 && resAVistaPago[0].values[0][0] !== null) {
        totalRecebidoMes += Number(resAVistaPago[0].values[0][0]);
    }

    // Recebimentos de entradas de vendas parceladas feitas no mês
    const resEntradas = db.exec("SELECT SUM(entrada) FROM vendas WHERE metodo = 'parcelado' AND entrada > 0 AND strftime('%Y-%m', data_venda) = ?", [anoMes]);
    if (resEntradas.length > 0 && resEntradas[0].values[0][0] !== null) {
        totalRecebidoMes += Number(resEntradas[0].values[0][0]);
    }

    // Recebimentos de parcelas e dívidas à vista pagas no mês
    const resParcelasPagas = db.exec("SELECT SUM(valor_parcela) FROM parcelas WHERE paga = 1 AND strftime('%Y-%m', data_pagamento) = ?", [anoMes]);
    if (resParcelasPagas.length > 0 && resParcelasPagas[0].values[0][0] !== null) {
        totalRecebidoMes += Number(resParcelasPagas[0].values[0][0]);
    }
    const resAVistaPagoDepois = db.exec("SELECT SUM(valor) FROM vendas WHERE metodo = 'a_vista_deve' AND pago = 1 AND strftime('%Y-%m', data_pagamento) = ?", [anoMes]);
    if (resAVistaPagoDepois.length > 0 && resAVistaPagoDepois[0].values[0][0] !== null) {
        totalRecebidoMes += Number(resAVistaPagoDepois[0].values[0][0]);
    }

    return { totalVendidoMes, totalRecebidoMes };
}

export async function getAniversariantesProximos() {
    // Retorna aniversariantes dos próximos 30 dias
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera a hora para comparação de datas
    const mesHoje = hoje.getMonth() + 1;

    // Formata para 'MM-DD' para comparação textual
    const hojeStr = `${String(mesHoje).padStart(2, '0')}-${String(diaHoje).padStart(2, '0')}`;

    const stmt = db.prepare(`
        SELECT nome, data_nascimento 
        FROM clientes 
        WHERE data_nascimento IS NOT NULL AND data_nascimento != '' 
    `);

    const aniversariantes = [];
    while (stmt.step()) {
        const cliente = stmt.getAsObject();
        if (cliente.data_nascimento) {
            const [ano, mes, dia] = cliente.data_nascimento.split('-');
            const dataAniversarioEsteAno = new Date(hoje.getFullYear(), parseInt(mes, 10) - 1, parseInt(dia, 10));
            
            // Se o aniversário já passou este ano, verifica o próximo ano
            if (dataAniversarioEsteAno < hoje) {
                dataAniversarioEsteAno.setFullYear(hoje.getFullYear() + 1);
            }

            const diffTime = dataAniversarioEsteAno.getTime() - hoje.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays <= 30) { // Aniversários de hoje até os próximos 30 dias
                aniversariantes.push({ nome: cliente.nome, data: dataAniversarioEsteAno });
            }
        }
    }
    stmt.free();
    return aniversariantes;
}

export async function getVencimentosDoDia() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeStr = hoje.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const vencimentos = [];

    // Busca parcelas vencendo hoje
    const queryParcelas = `
        SELECT c.nome, v.produto, p.valor_parcela
        FROM parcelas p
        JOIN vendas v ON p.venda_id = v.id
        JOIN clientes c ON v.cliente_id = c.id
        WHERE p.paga = 0 AND date(p.data_vencimento) = ?
    `;
    const resParcelas = db.exec(queryParcelas, [hojeStr]);
    if (resParcelas.length > 0) {
        resParcelas[0].values.forEach(row => vencimentos.push({ cliente: row[0], descricao: `Parcela de ${row[1]}`, valor: row[2] }));
    }

    // Busca vendas 'a_vista_deve' vencendo hoje
    const queryAVista = `
        SELECT c.nome, v.produto, v.valor, v.data_venda, v.dias_para_pagar
        FROM vendas v
        JOIN clientes c ON v.cliente_id = c.id
        WHERE v.pago = 0 AND v.metodo = 'a_vista_deve'
    `;
    const resAVista = db.exec(queryAVista);
    if (resAVista.length > 0) {
        resAVista[0].values.forEach(row => {
            const [nome, produto, valor, dataVenda, dias] = row;
            const dataVencimento = new Date(dataVenda);
            dataVencimento.setDate(dataVencimento.getDate() + dias);
            if (dataVencimento.toISOString().slice(0, 10) === hojeStr) {
                vencimentos.push({ cliente: nome, descricao: `Dívida de ${produto}`, valor: valor });
            }
        });
    }

    return vencimentos;
}

export async function getAniversariantesDoDia() {
    const hoje = new Date();
    const diaHoje = String(hoje.getDate()).padStart(2, '0');
    const mesHoje = String(hoje.getMonth() + 1).padStart(2, '0');
    const hojeStr = `${mesHoje}-${diaHoje}`; // Formato MM-DD

    // A data_nascimento está no formato 'YYYY-MM-DD', então usamos substr para pegar 'MM-DD'
    const stmt = db.prepare("SELECT nome FROM clientes WHERE substr(data_nascimento, 6) = :hoje");
    
    const aniversariantes = [];
    stmt.bind({ ':hoje': hojeStr });
    while (stmt.step()) {
        aniversariantes.push(stmt.get()[0]); // Pega só o nome
    }
    stmt.free();
    return aniversariantes;
}

export async function addCliente(nome, telefone, dataNascimento, endereco) {
    const dataCadastro = new Date().toISOString();
    db.run("INSERT INTO clientes (nome, telefone, data_cadastro, data_nascimento, endereco) VALUES (?, ?, ?, ?, ?)", [nome, telefone, dataCadastro, dataNascimento, endereco]);
    await saveDB();
}

export async function addVenda(venda) {
    const clienteRes = db.exec("SELECT id FROM clientes WHERE nome = ?", [venda.cliente]);
    if (!clienteRes.length || !clienteRes[0].values.length) {
        throw new Error(`Cliente "${venda.cliente}" não encontrado.`);
    }
    const clienteId = clienteRes[0].values[0][0];
    const dataVenda = new Date().toISOString();
    const valorBruto = venda.valorUnitario * venda.quantidade;
    const desconto = venda.desconto || 0;
    const valorFinal = valorBruto - desconto;
    const pago = venda.metodo === 'a_vista_pago' ? 1 : 0;

    const stmt = db.prepare(
        "INSERT INTO vendas (cliente_id, produto, quantidade, valor, metodo, entrada, num_parcelas, dias_para_pagar, data_venda, pago, observacao, desconto, data_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    stmt.run([clienteId, venda.produto, venda.quantidade, valorFinal, venda.metodo, venda.entrada, venda.numParcelas, venda.diasParaPagar, dataVenda, pago, venda.observacao, desconto]);
    stmt.free();

    const lastIdRes = db.exec("SELECT last_insert_rowid()");
    const vendaId = lastIdRes[0].values[0][0];

    if (venda.metodo === 'parcelado' && venda.numParcelas > 0) {
        const valorAParcelar = valorFinal - venda.entrada;
        const valorParcelaPadrao = parseFloat((valorAParcelar / venda.numParcelas).toFixed(2));
        const totalArredondado = valorParcelaPadrao * venda.numParcelas;
        const diferenca = parseFloat((valorAParcelar - totalArredondado).toFixed(2));

        const dataVendaObj = new Date(dataVenda);

        for (let i = 1; i <= venda.numParcelas; i++) {
            let valorParcelaCorrente = valorParcelaPadrao;
            if (i === venda.numParcelas) {
                valorParcelaCorrente = parseFloat((valorParcelaCorrente + diferenca).toFixed(2));
            }
            const dataVencimentoParcela = new Date(dataVendaObj);
            dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i);
            db.run("INSERT INTO parcelas (venda_id, numero_parcela, valor_parcela, data_vencimento) VALUES (?, ?, ?, ?)", [vendaId, i, valorParcelaCorrente, dataVencimentoParcela.toISOString()]);
        }
    }

    await saveDB();
    return vendaId;
}

export async function updateVenda(vendaId, venda) {
    const valorBruto = venda.valorUnitario * venda.quantidade;
    const desconto = venda.desconto || 0;
    const valorFinal = valorBruto - desconto;
    const pago = venda.metodo === 'a_vista_pago' ? 1 : 0;

    db.run("DELETE FROM parcelas WHERE venda_id = ?", [vendaId]);

    const stmt = db.prepare(
        `UPDATE vendas 
         SET produto = ?, quantidade = ?, valor = ?, metodo = ?, entrada = ?, num_parcelas = ?, 
             dias_para_pagar = ?, pago = ?, observacao = ?, desconto = ?
         WHERE id = ?`
    );
    stmt.run([venda.produto, venda.quantidade, valorFinal, venda.metodo, venda.entrada, venda.numParcelas, venda.diasParaPagar, pago, venda.observacao, desconto, vendaId]);
    stmt.free();

    if (venda.metodo === 'parcelado' && venda.numParcelas > 0) {
        const valorAParcelar = valorFinal - venda.entrada;
        const valorParcelaPadrao = parseFloat((valorAParcelar / venda.numParcelas).toFixed(2));
        const totalArredondado = valorParcelaPadrao * venda.numParcelas;
        const diferenca = parseFloat((valorAParcelar - totalArredondado).toFixed(2));

        const dataVendaRes = db.exec("SELECT data_venda FROM vendas WHERE id = ?", [vendaId]);
        const dataVendaObj = new Date(dataVendaRes[0].values[0][0]);

        for (let i = 1; i <= venda.numParcelas; i++) {
            let valorParcelaCorrente = valorParcelaPadrao;
            if (i === venda.numParcelas) {
                valorParcelaCorrente = parseFloat((valorParcelaCorrente + diferenca).toFixed(2));
            }
            const dataVencimentoParcela = new Date(dataVendaObj);
            dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i);
            db.run("INSERT INTO parcelas (venda_id, numero_parcela, valor_parcela, data_vencimento) VALUES (?, ?, ?, ?)", [vendaId, i, valorParcelaCorrente, dataVencimentoParcela.toISOString()]);
        }
    }

    await saveDB();
}

export async function updateClienteNome(antigoNome, novoNome) {
    db.run("UPDATE clientes SET nome = ? WHERE nome = ?", [novoNome, antigoNome]);
    await saveDB();
}

export async function deleteCliente(nome) {
    // First, get the client's ID
    const clienteRes = db.exec("SELECT id FROM clientes WHERE nome = ?", [nome]);
    
    if (clienteRes.length > 0 && clienteRes[0].values.length > 0) {
        const clienteId = clienteRes[0].values[0][0];

        // Find all sales (vendas) associated with this client
        const vendasRes = db.exec("SELECT id FROM vendas WHERE cliente_id = ?", [clienteId]);
        if (vendasRes.length > 0 && vendasRes[0].values.length > 0) {
            const vendaIds = vendasRes[0].values.flat();
            
            // Create a placeholder string for the IN clause (e.g., "?,?,?")
            const placeholders = vendaIds.map(() => '?').join(',');
            
            // Delete all parcels associated with those sales
            db.run(`DELETE FROM parcelas WHERE venda_id IN (${placeholders})`, vendaIds);
        }

        // Now, delete all sales associated with this client
        db.run("DELETE FROM vendas WHERE cliente_id = ?", [clienteId]);
    }

    // Finally, delete the client itself
    db.run("DELETE FROM clientes WHERE nome = ?", [nome]);
    await saveDB();
}

export async function deleteVenda(vendaId) {
    db.run("DELETE FROM vendas WHERE id = ?", [vendaId]);
    db.run("DELETE FROM parcelas WHERE venda_id = ?", [vendaId]);
    await saveDB();
}

export async function marcarVendaComoPaga(vendaId) {
    const dataPagamento = new Date().toISOString();
    db.run("UPDATE vendas SET pago = 1, data_pagamento = ? WHERE id = ?", [dataPagamento, vendaId]);
    await saveDB();
}

export async function updateParcelaStatus(parcelaId, paga, dataPagamento) {
    db.run("UPDATE parcelas SET paga = ?, data_pagamento = ? WHERE id = ?", [paga, dataPagamento, parcelaId]);
    await saveDB();
}

export function getDbFile() {
    return db.export();
}

export async function restoreDb(dataArray) {
    await saveToIndexedDB(dataArray);
    console.log("Banco de dados restaurado a partir do arquivo.");
}
