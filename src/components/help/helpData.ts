export interface HelpContent {
  title: string;
  subtitle: string;
  summary: string;
  whatToRegister: string[];
  tips: string[];
}

export const MODULE_HELP_DATA: Record<string, HelpContent> = {
  // 1. INÍCIO / DASHBOARD
  dashboard: {
    title: "Painel Geral & Indicadores",
    subtitle: "Visão consolidada do seu negócio em tempo real",
    summary:
      "O Painel Geral reúne as métricas mais importantes da empresa: total de vendas, faturamento, despesas operacionais, estoque crítico e ordens de fabricação pendentes.",
    whatToRegister: [
      "Este módulo não exige cadastro manual direto.",
      "Ele se alimenta automaticamente das Vendas, Compras, Produção, Estoque e Financeiro.",
      "Utilize os atalhos rápidos no topo para criar novos registros em 1 clique.",
    ],
    tips: [
      "Acompanhe diariamente os cards de alerta (estoque baixo e títulos a pagar hoje).",
      "No celular, arraste para baixo para atualizar seus indicadores em tempo real.",
    ],
  },

  // 2. ESTOQUE
  estoque: {
    title: "Gestão de Estoque & Saldos",
    subtitle: "Controle de saldos físicos, inventários e movimentações",
    summary:
      "Centraliza todos os saldos físicos de insumos, matérias-primas e produtos finais. Controla o histórico completo de entradas, saídas, perdas e ajustes.",
    whatToRegister: [
      "Ajustes manuais de inventário para bater o estoque físico com o sistema.",
      "Motivos de perda, quebra ou descarte de materiais.",
      "Transferências entre setores ou estoques auxiliares.",
    ],
    tips: [
      "As Compras (ao serem Recebidas) dão entrada automática de insumos.",
      "As Vendas (Faturadas) e a Produção (Finalizada) dão baixa automática no estoque.",
      "Defina o Estoque Mínimo no cadastro do produto para receber alertas preventivos antes de faltar material.",
    ],
  },

  // 3. PRODUTOS
  produtos: {
    title: "Cadastro de Produtos & Receitas",
    subtitle: "Itens, matérias-primas, custos, preços de venda e fichas técnicas",
    summary:
      "O coração do seu catálogo industrial e comercial. Aqui você cadastra tudo o que compra, estoca, transforma ou vende.",
    whatToRegister: [
      "Matérias-primas e Insumos: itens que você compra para usar na fabricação.",
      "Produtos Finais: itens acabados que sua fábrica produz e vende.",
      "Embalagens e Materiais de Apoio: caixas, fitas, rótulos e itens de higiene.",
      "Ficha Técnica (Receita / BOM): quanto de cada matéria-prima compõe 1 unidade do produto final.",
      "Preço de Custo e Preço de Venda sugerido.",
    ],
    tips: [
      "Cadastre sempre a Ficha Técnica nos 'Produtos Finais' para que a ordem de produção calcule o custo e dê baixa exata nos insumos.",
      "Use as opções de Embalagem (ex: Saco de 25kg, Fardo com 12 un) para facilitar o preenchimento de compras.",
    ],
  },

  // 4. VENDAS
  vendas: {
    title: "Pedidos & Vendas Comerciais",
    subtitle: "Orçamentos, pedidos de clientes e faturamento",
    summary:
      "Controle comercial de ponta a ponta: emissão de orçamentos, confirmação de pedidos, cálculo de totais e integração automática com estoque e contas a receber.",
    whatToRegister: [
      "Cliente comprador (selecionado do cadastro ou criado na hora).",
      "Produtos vendidos, quantidades e preços negociados.",
      "Status da venda (Orçamento → Pedido → Faturado → Entregue).",
      "Observações comerciais e condições de pagamento combinadas.",
    ],
    tips: [
      "Ao mudar o status para 'Faturado' ou 'Entregue', o sistema dá baixa no estoque e lança automaticamente no Contas a Receber.",
      "Você pode imprimir ou compartilhar o comprovante da venda em PDF ou WhatsApp diretamente pelo botão de ações.",
    ],
  },

  // 5. COMPRAS
  compras: {
    title: "Pedidos de Compra & Fornecedores",
    subtitle: "Cotações com fornecedores, pedidos e recebimento físico",
    summary:
      "Gerencia o ciclo de suprimentos da empresa: cotações de preços, aprovação de compras e conferência de entregas.",
    whatToRegister: [
      "Fornecedor contratado e data prevista de entrega.",
      "Itens e matérias-primas compradas com quantidade e custo unitário.",
      "Status do pedido (Em Cotação → Aprovado → Recebido).",
    ],
    tips: [
      "Ao clicar em 'Receber', o AGILIX automaticamente atualiza o estoque dos produtos e lança a despesa no Contas a Pagar.",
      "Aproveite as embalagens cadastradas no fornecedor para preencher pedidos rapidamente.",
    ],
  },

  // 6. PRODUÇÃO
  producao: {
    title: "Ordem de Fabricação (PCP)",
    subtitle: "Apontamento de lotes e transformação de matérias-primas",
    summary:
      "Planejamento e Controle da Produção (PCP). Permite abrir ordens de fabricação, acompanhar o andamento dos lotes no chão de fábrica e finalizar lotes prontos.",
    whatToRegister: [
      "Produto Final a ser fabricado.",
      "Quantidade planejada do lote.",
      "Data de início e previsão de término.",
      "Status da ordem: 'Planejada', 'Em Produção' ou 'Finalizada'.",
    ],
    tips: [
      "Ao finalizar uma ordem, o AGILIX consulta a Ficha Técnica (BOM) do produto e dá baixa automática em todos os insumos consumidos, adicionando o produto final no estoque.",
      "Caso necessite produzir de emergência sem baixa de receita, selecione a opção de apontamento direto.",
    ],
  },

  // 7. FINANCEIRO
  financeiro: {
    title: "Gestão Financeira Completa",
    subtitle: "Contas a pagar, contas a receber, fluxo de caixa e DRE",
    summary:
      "Gerencia a saúde financeira da empresa: lançamentos manuais e automáticos, previsões de caixa, despesas por categoria e demonstrativo de resultados.",
    whatToRegister: [
      "Contas a Pagar: contas de consumo, tributos, aluguel, manutenção e fornecedores.",
      "Contas a Receber: valores de vendas a prazo, boletos ou contratos de clientes.",
      "Parcelamentos: compras ou vendas parceladas com geração automática de parcelas.",
      "Categorias financeiras para organizar centros de custo.",
    ],
    tips: [
      "Utilize o botão de 'Baixa Rápida' (Receber / Pagar) para liquidar títulos em 1 toque com a data de hoje.",
      "Monitore a aba 'Fluxo Projetado' para saber com antecedência se faltará dinheiro para honrar compromissos no mês.",
    ],
  },

  // 8. CUSTOS
  custos: {
    title: "Custos & Formação de Preços",
    subtitle: "Margem de contribuição, lucratividade e formação de preço",
    summary:
      "Analisa a rentabilidade real de cada produto final fabricado. Compara o custo total de fabricação com o preço praticado no mercado.",
    whatToRegister: [
      "Atualização rápida de preço de custo ou preço de venda sugerido.",
      "Margem de lucro desejada para garantir que nenhum produto seja vendido com prejuízo.",
    ],
    tips: [
      "Produtos com margem negativa ou abaixo de 20% são sinalizados para que você revise a receita ou aumente o preço.",
      "Clique em 'Editar Preço' para simular novos valores e ver a margem recalculada instantaneamente.",
    ],
  },

  // 9. RELATÓRIOS
  relatorios: {
    title: "Relatórios & Análise de Dados",
    subtitle: "Histórico detalhado e exportação de planilhas para tomada de decisão",
    summary:
      "Consolida dados históricos de todos os módulos para auditoria, contabilidade e planejamento estratégico da diretoria.",
    whatToRegister: [
      "Filtros de data e período para geração de relatórios sob medida.",
      "Exportação direta de dados em formato CSV para Excel/Google Sheets.",
    ],
    tips: [
      "Gere o relatório mensal de vendas e compras para enviar ao seu contador no fechamento do mês.",
      "Avalie os produtos mais vendidos para priorizar a fabricação.",
    ],
  },

  // 10. CADASTROS
  cadastros: {
    title: "Base Central de Cadastros",
    subtitle: "Clientes, fornecedores parceiros e equipe do sistema",
    summary:
      "Armazena as informações das pessoas e empresas com as quais o seu negócio se relaciona diariamente.",
    whatToRegister: [
      "Clientes: nome/razão social, CPF/CNPJ, WhatsApp, endereço completo (com busca automática por CEP) e limite de crédito.",
      "Fornecedores: CNPJ, telefone, vendedor responsável e itens que fornecem.",
      "Usuários / Staff: permissões de acesso ao sistema (Administrador, Operador, Vendedor).",
    ],
    tips: [
      "O botão de WhatsApp verde permite abrir uma conversa diretamente com o cliente ou fornecedor sem precisar salvar o número na sua agenda.",
      "Ao digitar o CEP, os campos de endereço, bairro, cidade e estado são preenchidos automaticamente.",
    ],
  },

  // 11. RH (RECURSOS HUMANOS)
  rh: {
    title: "Recursos Humanos & Gestão de Equipe",
    subtitle: "Colaboradores, controle de férias, faltas e folha salarial",
    summary:
      "Centraliza a gestão de pessoal: dados contratuais (CLT/PJ), escala de férias, controle de ocorrências e alertas de pagamentos de adiantamentos e salários.",
    whatToRegister: [
      "Colaboradores: nome, cargo, departamento, tipo de contrato (CLT/PJ), salário base e chave Pix.",
      "Férias: agendamento de períodos de descanso, abono pecuniário (dias vendidos) e 13º salário.",
      "Ocorrências: atestados médicos, faltas justificadas e horas extras.",
      "Alertas de Pagamento: Vale (40% dia 20) e Saldo de Salário (60% dia 05).",
    ],
    tips: [
      "O sistema avisa automaticamente a aproximação do pagamento do Vale (dia 20) e do Saldo da Folha (dia 05).",
      "Você pode enviar a folha calculada diretamente para o Contas a Pagar do Financeiro.",
    ],
  },
};
