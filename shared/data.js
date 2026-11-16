/* FORNO A LENHA — camada de dados compartilhada entre o site e o painel (demo em localStorage).
   Mesma origem => pedido feito no site aparece no painel na hora (BroadcastChannel + storage event).
   Em produção isso vira Supabase; a API abaixo é o contrato. NÃO alterar assinaturas.
   Cardápio e preços: copiados do MenuDino deles (fornoalenhapizza.menudino.com) em 13/11/2026.
   Tudo marcado EXEMPLO precisa ser confirmado com o dono. */
(function () {
  const KEY = 'fl_db_v1';
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('fl_sync') : null;
  const listeners = [];

  const LOJA = {
    nome: 'Forno a Lenha', slogan: 'Pizzaria 100% artesanal', instagram: 'pizzariafornoalenha_ofc',
    whatsapp: '557133326000', whatsappFmt: '(71) 3332-6000',
    endereco: 'Av. Cardeal da Silva, 180 — Federação, Salvador-BA',
    // Google mostra "abre às 17:30"; fechamento e dias A CONFIRMAR.
    horarios: { fechado: [], turnos: [['17:30', '23:00']], texto: 'Todos os dias · a partir das 17h30' },
  };

  // gramas = peso médio da pizza pronta (EXEMPLO, alimenta a ficha técnica e a baixa de estoque)
  const TAMANHOS = [
    { id: 'p', nome: 'Pequena', sigla: 'P', gramas: 450, desc: 'Pequena' },
    { id: 'm', nome: 'Média', sigla: 'M', gramas: 650, desc: 'Média' },
    { id: 'g', nome: 'Grande', sigla: 'G', gramas: 900, desc: 'Grande' },
    { id: 'gg', nome: 'Família', sigla: 'GG', gramas: 1200, desc: 'Família' },
  ];
  // tabela real por categoria (P, M, G, GG). Doces e Exclusivas: só o "a partir de" foi conferido; resto segue a faixa. A CONFIRMAR.
  const FAIXAS = {
    Tradicionais: [33.9, 39.9, 49.9, 59.9], Doces: [33.9, 39.9, 49.9, 59.9],
    Especiais: [39.9, 48.9, 59.9, 66.9], Exclusivas: [39.9, 48.9, 59.9, 66.9],
    Nobres: [48.9, 59.9, 68.9, 74.9],
  };
  const CATS = Object.keys(FAIXAS);
  const S = (cat, nome, desc, foto) => ({ id: nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), cat, nome, desc, foto: foto || '' });
  const SABORES = [
    S('Tradicionais', 'Abobrinha', 'Molho, mussarela, abobrinha, parmesão'),
    S('Tradicionais', 'Alho Frito', 'Molho, mussarela, alho frito'),
    S('Tradicionais', 'Baiana', 'Molho, mussarela, calabresa moída, orégano, pimenta calabresa', 'baiana.jpg'),
    S('Tradicionais', 'Caipira', 'Molho, mussarela, frango, milho, tomate, orégano'),
    S('Tradicionais', 'Calabresa', 'Molho, mussarela, calabresa, cebola, orégano', 'calabresa.jpg'),
    S('Tradicionais', 'Federação', 'Molho, mussarela, presunto, ervilha, azeitona, orégano'),
    S('Tradicionais', 'Frango Catupiry', 'Molho, mussarela, frango, catupiry, orégano', 'frango.jpg'),
    S('Tradicionais', 'Marguerita', 'Molho, mussarela, tomate, parmesão, manjericão', 'marguerita.jpg'),
    S('Tradicionais', 'Milho Verde', 'Molho, mussarela, milho verde, orégano'),
    S('Tradicionais', 'Mista', 'Molho, mussarela, presunto'),
    S('Tradicionais', 'Moda da Casa', 'Molho, mussarela, presunto, calabresa, cebola, orégano', 'moda.jpg'),
    S('Tradicionais', 'Mussarela', 'Molho, mussarela, orégano'),
    S('Tradicionais', 'Napolitana', 'Molho, mussarela, tomate, azeitona, orégano'),
    S('Tradicionais', 'Palmito', 'Molho, mussarela, palmito, orégano, manjericão'),
    S('Tradicionais', 'Portuguesa', 'Molho, mussarela, presunto, ovos, ervilha, cebola, orégano'),
    S('Doces', 'Brigadeiro', 'Mussarela, brigadeiro, granulado', 'brigadeiro.jpg'),
    S('Doces', 'Doce de Leite', 'Mussarela, doce de leite, paçoca'),
    S('Doces', 'Romeu e Julieta', 'Mussarela, goiabada'),
    S('Especiais', '4 Queijos', 'Molho, mussarela, catupiry, provolone, gorgonzola, parmesão, orégano', 'queijos.jpg'),
    S('Especiais', 'Atum Cebola', 'Molho, mussarela, atum, cebola, orégano'),
    S('Especiais', 'Bacon Catupiry', 'Molho, mussarela, bacon, catupiry, orégano'),
    S('Especiais', 'Champignon', 'Molho, mussarela, champignon, catupiry, orégano'),
    S('Especiais', 'Coisa e Tal', 'Molho, mussarela, frango, bacon, provolone, azeitona, manjericão'),
    S('Especiais', 'Do Chefe', 'Molho, mussarela, frango, bacon, catupiry, cebola, orégano'),
    S('Especiais', 'Do Rancho', 'Molho, mussarela, frango, catupiry, provolone, gorgonzola, parmesão, orégano'),
    S('Especiais', 'Engenheiro', 'Molho, mussarela, presunto, champignon, alho, orégano'),
    S('Especiais', 'Lombinho Cebola', 'Molho, mussarela, lombinho, azeitona, cebola, orégano'),
    S('Especiais', 'Peru Cebola', 'Molho, mussarela, peito de peru, azeitona, cebola, orégano'),
    S('Especiais', 'Siciliana', 'Molho, mussarela, bacon, champignon, azeitona, cebola, orégano'),
    S('Especiais', 'Tomate Seco', 'Molho, mussarela, tomate seco, orégano, rúcula'),
    S('Especiais', 'Vegetariana', 'Molho, mussarela, champignon, palmito, tomate, milho, azeitona, orégano, rúcula'),
    S('Exclusivas', 'Abobrinha Cheese', 'Molho, mussarela, abobrinha, cream cheese, orégano'),
    S('Exclusivas', 'Corn Bacon', 'Molho, mussarela, bacon, milho verde, orégano'),
    S('Exclusivas', 'Costela de Boi', 'Molho, mussarela, costela bovina, cebola, orégano'),
    S('Exclusivas', 'Costelinha Barbecue', 'Molho, mussarela, costelinha, barbecue'),
    S('Exclusivas', 'Do Engenho', 'Molho, mussarela, filezinho, tomate seco, orégano, molho rosé'),
    S('Exclusivas', 'Filezinho ao Molho Madeira', 'Molho, mussarela, filezinho de carne, orégano, molho madeira'),
    S('Exclusivas', 'Fumeiro', 'Molho, mussarela, fumeiro, azeitona, cebola, orégano'),
    S('Exclusivas', 'Lombinho Abacaxi', 'Mussarela, doce de abacaxi, lombinho, cream cheese'),
    S('Exclusivas', 'Pernil Cebola', 'Molho, mussarela, pernil suíno, cebola, orégano'),
    S('Exclusivas', 'Peru Geleia', 'Mussarela, peito de peru, cream cheese, geleia, manjericão'),
    S('Nobres', 'Carne do Sol Cebola', 'Molho, mussarela, carne do sol, cebola, orégano'),
    S('Nobres', 'Carne Seca Catupiry', 'Molho, mussarela, carne seca, catupiry, orégano'),
    S('Nobres', 'Carne Seca Cebola', 'Molho, mussarela, carne seca, cebola, orégano'),
    S('Nobres', 'Peperoni Cebola', 'Molho, mussarela, peperoni, cebola, orégano', 'peperoni.jpg'),
    S('Nobres', 'Sertaneja', 'Molho, mussarela, carne seca, banana da terra, orégano', 'sertaneja.jpg'),
    S('Nobres', 'Supreme', 'Molho, mussarela, calabresa, bacon, tomate, azeitona, palmito, orégano'),
  ];
  const PRECOS = {};
  TAMANHOS.forEach((t, i) => { PRECOS[t.id] = {}; SABORES.forEach(s => { PRECOS[t.id][s.id] = FAIXAS[s.cat][i]; }); });

  // Combos, bordas e bebidas: preços reais do MenuDino.
  const EXTRAS = [
    { id: 'combo-medio', cat: 'Combos', nome: 'Combo Médio', desc: 'Pizza Média + refri lata', preco: 40.9, real: true },
    { id: 'combo-grande', cat: 'Combos', nome: 'Combo Grande', desc: 'Pizza Grande + refri 1L', preco: 54.9, real: true },
    { id: 'combo-familia', cat: 'Combos', nome: 'Combo Família', desc: 'Pizza Família + refri 1L', preco: 64.9, real: true },
    { id: 'combo-2-grandes', cat: 'Combos', nome: 'Combo 2 Grandes', desc: '2 Pizzas Grandes + refri 1L', preco: 94.9, real: true },
    { id: 'combo-2-familia', cat: 'Combos', nome: 'Combo 2 Família', desc: '2 Pizzas Família + refri 1L', preco: 114.9, real: true },
    { id: 'combo-3-grandes', cat: 'Combos', nome: 'Combo 3 Grandes', desc: '3 Pizzas Grandes + 2 refri 1L', preco: 149.8, real: true },
    { id: 'combo-3-familia', cat: 'Combos', nome: 'Combo 3 Família', desc: '3 Pizzas Família + 2 refri 1L', preco: 179.8, real: true },
    { id: 'borda-p', cat: 'Borda de Catupiry', nome: 'Borda de Catupiry (P)', preco: 9.9, real: true },
    { id: 'borda-m', cat: 'Borda de Catupiry', nome: 'Borda de Catupiry (M)', preco: 12.9, real: true },
    { id: 'borda-g', cat: 'Borda de Catupiry', nome: 'Borda de Catupiry (G)', preco: 15.9, real: true },
    { id: 'borda-gg', cat: 'Borda de Catupiry', nome: 'Borda de Catupiry (GG)', preco: 19.9, real: true },
    { id: 'coca-1l', cat: 'Bebidas', nome: 'Coca-Cola 1L', preco: 11, real: true },
    { id: 'pepsi-1l', cat: 'Bebidas', nome: 'Pepsi 1L', preco: 9, real: true },
    { id: 'coca-lata', cat: 'Bebidas', nome: 'Coca-Cola lata 350 ml', preco: 6, real: true },
    { id: 'amstel', cat: 'Bebidas', nome: 'Amstel 350 ml', preco: 7, real: true },
  ];
  // Taxas de EXEMPLO por bairro (o MenuDino deles mostra taxa de R$ 6 a R$ 15; a tabela real fica com o dono).
  const BAIRROS = [
    { nome: 'Federação', taxa: 6, min: 30 }, { nome: 'Engenho Velho da Federação', taxa: 6, min: 30 }, { nome: 'Garcia', taxa: 8, min: 30 },
    { nome: 'Ondina', taxa: 8, min: 30 }, { nome: 'Rio Vermelho', taxa: 9, min: 35 }, { nome: 'Graça', taxa: 10, min: 35 },
    { nome: 'Canela', taxa: 10, min: 35 }, { nome: 'Barra', taxa: 12, min: 40 }, { nome: 'Vasco da Gama', taxa: 9, min: 35 },
    { nome: 'Brotas', taxa: 12, min: 40 }, { nome: 'Campo Grande', taxa: 12, min: 40 }, { nome: 'Barris', taxa: 13, min: 40 },
    { nome: 'Amaralina', taxa: 13, min: 45 }, { nome: 'Pituba', taxa: 15, min: 50 },
  ];

  // ESTOQUE de EXEMPLO. O dono troca quantidades e custos no painel.
  const ESTOQUE = [
    { id: 'massa', nome: 'Massa artesanal (farinha, fermento, azeite)', un: 'g', qtd: 42000, min: 15000, custo: 0.006 },
    { id: 'molho', nome: 'Molho de tomate da casa', un: 'g', qtd: 14000, min: 6000, custo: 0.009 },
    { id: 'mussarela', nome: 'Mussarela', un: 'g', qtd: 9500, min: 12000, custo: 0.039 },
    { id: 'calabresa', nome: 'Calabresa', un: 'g', qtd: 8200, min: 4000, custo: 0.028 },
    { id: 'presunto', nome: 'Presunto', un: 'g', qtd: 6100, min: 3000, custo: 0.026 },
    { id: 'frango', nome: 'Frango desfiado', un: 'g', qtd: 7400, min: 3500, custo: 0.024 },
    { id: 'catupiry', nome: 'Catupiry', un: 'g', qtd: 5200, min: 3000, custo: 0.036 },
    { id: 'bacon', nome: 'Bacon', un: 'g', qtd: 3100, min: 2000, custo: 0.045 },
    { id: 'carneseca', nome: 'Carne seca / carne do sol', un: 'g', qtd: 1800, min: 2500, custo: 0.068 },
    { id: 'peperoni', nome: 'Peperoni', un: 'g', qtd: 2400, min: 1500, custo: 0.072 },
    { id: 'queijos', nome: 'Queijos especiais (provolone, gorgonzola, parmesão)', un: 'g', qtd: 3600, min: 2000, custo: 0.062 },
    { id: 'carnes', nome: 'Carnes especiais (filezinho, costela, lombinho, pernil, peru, fumeiro)', un: 'g', qtd: 5400, min: 3000, custo: 0.052 },
    { id: 'hortifruti', nome: 'Hortifrúti (cebola, tomate, milho, palmito, champignon, azeitona...)', un: 'g', qtd: 11000, min: 5000, custo: 0.012 },
    { id: 'doces', nome: 'Doces (brigadeiro, doce de leite, goiabada)', un: 'g', qtd: 3200, min: 1500, custo: 0.03 },
    { id: 'lenha', nome: 'Lenha', un: 'kg', qtd: 180, min: 120, custo: 0.9 },
    { id: 'cx-p', nome: 'Caixa de pizza P', un: 'un', qtd: 90, min: 40, custo: 1.1 },
    { id: 'cx-m', nome: 'Caixa de pizza M', un: 'un', qtd: 110, min: 50, custo: 1.4 },
    { id: 'cx-g', nome: 'Caixa de pizza G', un: 'un', qtd: 46, min: 80, custo: 1.8 },
    { id: 'cx-gg', nome: 'Caixa de pizza GG', un: 'un', qtd: 95, min: 60, custo: 2.3 },
    { id: 'refri-1l', nome: 'Refrigerante 1L', un: 'un', qtd: 72, min: 36, custo: 5.2 },
    { id: 'refri-lata', nome: 'Refrigerante lata', un: 'un', qtd: 48, min: 24, custo: 3.1 },
  ];
  // Ficha técnica (g por 100 g de pizza pronta) — EXEMPLO montado a partir dos ingredientes do cardápio. O dono ajusta no painel.
  const MAPA = [
    [/calabresa(?! \))/, 'calabresa', 14], [/presunto/, 'presunto', 12], [/frango/, 'frango', 14], [/catupiry|cream cheese/, 'catupiry', 8],
    [/bacon/, 'bacon', 9], [/carne seca|carne do sol/, 'carneseca', 14], [/peperoni/, 'peperoni', 12],
    [/provolone|gorgonzola|parmes/, 'queijos', 8], [/filezinho|costel|lombinho|pernil|peru|fumeiro|atum/, 'carnes', 14],
    [/cebola|tomate|milho|palmito|champignon|azeitona|ervilha|abobrinha|alho|r[uú]cula|banana|ovos|manjeric/, 'hortifruti', 9],
    [/brigadeiro|doce de|goiabada|geleia|granulado|pa[cç]oca/, 'doces', 16],
  ];
  const FICHA = {
    base: { massa: 46, molho: 10, mussarela: 20 },
    proteina: {},
    embalagem: { p: 'cx-p', m: 'cx-m', g: 'cx-g', gg: 'cx-gg' },
    lenhaKgPorPizza: 0.35,
  };
  SABORES.forEach(s => { const o = {}, d = s.desc.toLowerCase(); MAPA.forEach(([re, k, g]) => { if (re.test(d)) o[k] = g; }); FICHA.proteina[s.id] = o; });

  const ENTREGADORES = [
    { id: 'e1', nome: 'Motoboy 1 (exemplo)', tel: '5571900000001', ativo: true },
    { id: 'e2', nome: 'Motoboy 2 (exemplo)', tel: '5571900000002', ativo: true },
    { id: 'e3', nome: 'Motoboy iFood (sob demanda)', tel: '', ativo: true, ifood: true },
  ];
  const CONFIG = {
    // Fidelidade é PROPOSTA nossa (eles não têm hoje). Regra de exemplo.
    fidelidade: { meta: 10, premio: 'Pizza Média Tradicional', premioTamanho: 'm', pedidoMinimo: 40, canais: ['site', 'whatsapp'], validadeDias: 90 },
    taxaIfoodPct: 26.2, // plano Entrega do iFood: 23% + 3,2% pagamento online (tabela oficial; plano deles a confirmar)
    pagamentos: { mercadoPago: { conectado: true, conta: 'Forno a Lenha (demonstração)' }, aceita: { pix: true, credito: true, debito: true, dinheiro: true, cartao: true }, taxasPct: { pix: 0.99, credito: 4.98, debito: 1.99 } },
    tempoPreparoMin: 35, pixChave: 'CHAVE-PIX-DA-LOJA (exemplo)', lojaAberta: 'auto', // 'auto' | 'aberta' | 'fechada'
  };
  const STATUS = [
    { id: 'novo', nome: 'Novo' }, { id: 'preparo', nome: 'No forno' }, { id: 'pronto', nome: 'Pronto' },
    { id: 'rota', nome: 'Saiu p/ entrega' }, { id: 'concluido', nome: 'Concluído' }, { id: 'cancelado', nome: 'Cancelado' },
  ];

  // formas de pagamento. pix/credito/debito = pagos online (pedido chega com pago:true); dinheiro/cartao = na entrega/retirada.
  const PAGAMENTOS = [
    { id: 'pix', nome: 'Pix', online: true }, { id: 'credito', nome: 'Cartão de crédito', online: true }, { id: 'debito', nome: 'Cartão de débito', online: true },
    { id: 'dinheiro', nome: 'Dinheiro', online: false }, { id: 'cartao', nome: 'Maquininha na entrega', online: false },
  ];
  // faixa de CEP (5 primeiros dígitos) -> bairro: só reserva para quando o ViaCEP não responde. Aproximado.
  const CEP_RESERVA = { '40231': 'Federação', '40210': 'Federação', '40220': 'Engenho Velho da Federação', '40100': 'Garcia', '40170': 'Ondina', '41940': 'Rio Vermelho', '41950': 'Rio Vermelho', '40150': 'Graça', '40110': 'Canela', '40140': 'Barra', '40070': 'Barris', '41810': 'Pituba', '41830': 'Pituba', '40290': 'Brotas' };
  const norm = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const tel = t => String(t || '').replace(/\D/g, '').replace(/^55/, '');
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const brl = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function seed() {
    const now = Date.now(), d = n => new Date(now - n * 864e5).toISOString();
    const clientes = [
      ['Marina Souza', '71991110001', 'Federação', 7, 14], ['Rafael Lima', '71991110002', 'Garcia', 9, 22], ['Dona Célia', '71991110003', 'Canela', 3, 5],
      ['Thiago Barreto', '71991110004', 'Barra', 10, 31], ['Luana Reis', '71991110005', 'Garcia', 1, 1], ['Dr. Paulo Menezes', '71991110006', 'Ondina', 5, 9],
      ['Bianca Farias', '71991110007', 'Federação', 0, 4], ['Escritório Almeida Adv.', '71991110008', 'Rio Vermelho', 6, 12],
    ].map(([nome, t, bairro, selos, pedidos], i) => ({
      id: 'c' + (i + 1), nome, tel: t, bairro, endereco: '', selos: selos % 10, cartoesCompletos: Math.floor(pedidos / 10),
      vouchers: selos >= 10 ? [{ id: uid('v'), premio: 'Pizza Média Tradicional', criado: d(2), usado: null }] : [],
      pedidos, gasto: pedidos * 58, primeiro: d(120 - i * 9), ultimo: d([1, 2, 38, 0, 6, 3, 52, 4][i]), obs: i === 2 ? 'Sem cebola' : '', tags: [],
    }));
    return {
      v: 1, criado: new Date().toISOString(), loja: LOJA, tamanhos: TAMANHOS, sabores: SABORES, precos: PRECOS, extras: EXTRAS,
      pausados: [], bairros: BAIRROS, ficha: FICHA, estoque: ESTOQUE, movEstoque: [], entregadores: ENTREGADORES, config: CONFIG,
      clientes, pedidos: [], seq: 2310, demo: true,
    };
  }

  function db() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY));
      if (r && r.v === 1) { if (!r.config.pagamentos) r.config.pagamentos = JSON.parse(JSON.stringify(CONFIG.pagamentos)); return r; }
    } catch (e) {}
    const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s;
  }
  function save(d) {
    localStorage.setItem(KEY, JSON.stringify(d));
    if (bc) bc.postMessage('chg');
    listeners.forEach(f => f(d));
  }
  function on(f) { listeners.push(f); }
  if (bc) bc.onmessage = () => { const d = db(); listeners.forEach(f => f(d)); };
  window.addEventListener('storage', e => { if (e.key === KEY) { const d = db(); listeners.forEach(f => f(d)); } });
  function reset() { localStorage.removeItem(KEY); const d = db(); save(d); return d; }

  function aberta(d = db(), quando = new Date()) {
    if (d.config.lojaAberta !== 'auto') return d.config.lojaAberta === 'aberta';
    if (LOJA.horarios.fechado.includes(quando.getDay())) return false;
    const hm = quando.toTimeString().slice(0, 5);
    return LOJA.horarios.turnos.some(([a, b]) => hm >= a && hm < b);
  }
  function preco(d, tamanho, sabor) { return (d.precos[tamanho] || {})[sabor] || 0; }
  function clientePorTel(d, t) { t = tel(t); return d.clientes.find(c => tel(c.tel) === t) || null; }

  /* pedido = { canal:'site'|'whatsapp'|'balcao'|'ifood', cliente:{nome,tel}, tipo:'entrega'|'retirada',
       endereco:{bairro,rua,numero,compl,ref}, itens:[{tipo:'yaki',tamanho,sabor,qtd,obs,preco,gratis?}|{tipo:'extra',id,nome,qtd,preco}],
       pagamento:'pix'|'cartao'|'dinheiro', troco, voucherId?, obs, agendadoPara? }  → devolve o pedido salvo */
  function criarPedido(p) {
    const d = db();
    const subtotal = p.itens.reduce((s, i) => s + (i.gratis ? 0 : i.preco * i.qtd), 0);
    const b = p.tipo === 'entrega' ? d.bairros.find(x => x.nome === (p.endereco || {}).bairro) : null;
    const taxa = p.tipo === 'entrega' ? (p.taxa != null ? p.taxa : b ? b.taxa : 0) : 0;
    let c = clientePorTel(d, p.cliente.tel);
    if (!c) {
      c = { id: uid('c'), nome: p.cliente.nome, tel: tel(p.cliente.tel), bairro: (p.endereco || {}).bairro || '', endereco: '', selos: 0, cartoesCompletos: 0, vouchers: [], pedidos: 0, gasto: 0, primeiro: new Date().toISOString(), ultimo: null, obs: '', tags: ['novo'] };
      d.clientes.push(c);
    }
    if (p.endereco && p.endereco.rua) { c.endereco = [p.endereco.rua, p.endereco.numero, p.endereco.compl].filter(Boolean).join(', '); c.bairro = p.endereco.bairro; }
    if (p.voucherId) { const v = c.vouchers.find(x => x.id === p.voucherId && !x.usado); if (v) v.usado = new Date().toISOString(); }
    const ped = Object.assign({}, p, {
      id: uid('p'), num: ++d.seq, clienteId: c.id, subtotal, taxa, total: subtotal + taxa, status: 'novo',
      criado: new Date().toISOString(), hist: [{ s: 'novo', t: new Date().toISOString() }], entregadorId: null, repasse: 0, seloDado: false, estoqueBaixado: false,
    });
    d.pedidos.unshift(ped); save(d); return ped;
  }

  // consumo de insumos de um pedido: { insumoId: quantidade }
  function consumo(d, ped) {
    const out = {}, add = (k, v) => { if (k) out[k] = (out[k] || 0) + v; };
    ped.itens.forEach(i => {
      if (i.tipo === 'yaki') { // 'yaki' = item de pizza (nome interno herdado do contrato)
        const g = (d.tamanhos.find(t => t.id === i.tamanho) || {}).gramas || 0, f = g / 100 * i.qtd;
        Object.entries(d.ficha.base).forEach(([k, v]) => add(k, v * f));
        Object.entries(d.ficha.proteina[i.sabor] || {}).forEach(([k, v]) => add(k, v * f));
        add(d.ficha.embalagem[i.tamanho], i.qtd); add('lenha', (d.ficha.lenhaKgPorPizza || 0) * i.qtd);
      } else if (/1l/.test(i.id || '')) add('refri-1l', i.qtd);
      else if (/lata/.test(i.id || '')) add('refri-lata', i.qtd);
    });
    return out;
  }

  /* muda status; efeitos: 'preparo' baixa estoque (1x); 'concluido' dá selo de fidelidade (1x) e atualiza CRM;
     'cancelado' devolve estoque e voucher. Devolve { pedido, cliente, ganhouVoucher } */
  function mudarStatus(id, status, extra) {
    const d = db(), ped = d.pedidos.find(p => p.id === id); if (!ped) return null;
    const c = d.clientes.find(x => x.id === ped.clienteId); let ganhouVoucher = false;
    Object.assign(ped, extra || {}); ped.status = status; ped.hist.push({ s: status, t: new Date().toISOString() });
    if (status === 'preparo' && !ped.estoqueBaixado) {
      Object.entries(consumo(d, ped)).forEach(([k, q]) => { const e = d.estoque.find(x => x.id === k); if (e) e.qtd = Math.max(0, e.qtd - q); });
      d.movEstoque.unshift({ t: new Date().toISOString(), tipo: 'saida', ref: 'Pedido #' + ped.num, itens: consumo(d, ped) }); ped.estoqueBaixado = true;
    }
    if (status === 'cancelado') {
      if (ped.estoqueBaixado) { Object.entries(consumo(d, ped)).forEach(([k, q]) => { const e = d.estoque.find(x => x.id === k); if (e) e.qtd += q; }); ped.estoqueBaixado = false; }
      if (ped.voucherId && c) { const v = c.vouchers.find(x => x.id === ped.voucherId); if (v) v.usado = null; }
    }
    if (status === 'concluido' && c && !ped.seloDado) {
      c.pedidos++; c.gasto += ped.total; c.ultimo = new Date().toISOString(); c.tags = (c.tags || []).filter(t => t !== 'novo');
      const f = d.config.fidelidade;
      if (f.canais.includes(ped.canal) && ped.subtotal >= f.pedidoMinimo) { ganhouVoucher = darSelo(d, c, 'Pedido #' + ped.num); ped.seloDado = true; }
    }
    save(d); return { pedido: ped, cliente: c, ganhouVoucher };
  }
  // dá 1 selo; ao completar a meta zera o cartão e gera voucher. Use direto no painel p/ carimbo manual (pedido de WhatsApp antigo).
  function darSelo(d, c, motivo) {
    const f = d.config.fidelidade; c.selos++; c.histSelos = c.histSelos || []; c.histSelos.unshift({ t: new Date().toISOString(), motivo });
    if (c.selos >= f.meta) { c.selos = 0; c.cartoesCompletos++; c.vouchers.push({ id: uid('v'), premio: f.premio, criado: new Date().toISOString(), usado: null }); return true; }
    return false;
  }
  function vouchersAtivos(d, c) {
    const lim = d.config.fidelidade.validadeDias * 864e5;
    return (c ? c.vouchers : []).filter(v => !v.usado && Date.now() - new Date(v.criado) < lim);
  }
  /* CEP -> endereço + zona de entrega. Devolve Promise de
     { ok, cep, rua, bairro, cidade, uf, naZona, taxa, min, fonte:'viacep'|'reserva' } ou { ok:false, erro } */
  async function cepInfo(cep) {
    cep = String(cep || '').replace(/\D/g, ''); if (cep.length !== 8) return { ok: false, erro: 'CEP incompleto' };
    let r = null;
    try {
      const x = await (await fetch('https://viacep.com.br/ws/' + cep + '/json/')).json();
      if (!x.erro) r = { rua: x.logradouro || '', bairro: x.bairro || '', cidade: x.localidade, uf: x.uf, fonte: 'viacep' };
      else return { ok: false, erro: 'CEP não encontrado' };
    } catch (e) { const b = CEP_RESERVA[cep.slice(0, 5)]; if (b) r = { rua: '', bairro: b, cidade: 'Salvador', uf: 'BA', fonte: 'reserva' }; }
    if (!r) return { ok: false, erro: 'Não foi possível consultar o CEP agora' };
    const b = r.uf === 'BA' && norm(r.cidade) === 'salvador' ? db().bairros.find(z => norm(z.nome) === norm(r.bairro)) : null;
    return Object.assign({ ok: true, cep, naZona: !!b, taxa: b ? b.taxa : null, min: b ? b.min : null }, r, b ? { bairro: b.nome } : {});
  }
  function waLink(texto, numero) { return 'https://wa.me/' + (numero || LOJA.whatsapp) + '?text=' + encodeURIComponent(texto); }

  window.YK = { KEY, LOJA, CATS, FAIXAS, STATUS, PAGAMENTOS, cepInfo, norm, db, save, on, reset, aberta, preco, clientePorTel, criarPedido, mudarStatus, darSelo, vouchersAtivos, consumo, waLink, tel, uid, brl };
})();
