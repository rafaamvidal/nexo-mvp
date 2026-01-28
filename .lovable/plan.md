
Objetivo
- Atualizar a identidade oficial do sistema para “Nexo ERP”.
- Ajustar título/meta tags do HTML para “Nexo ERP | Gestão Inteligente”.
- Trocar textos genéricos/antigos por “Nexo ERP”.
- Substituir o texto do “cabeçalho” por logotipo (Sidebar e Login) usando a imagem fornecida.
- Manter o Design System (paleta Esmeralda/Slate + glassmorphism) intacto e garantir boa legibilidade do logo em fundos claros/escuros.

Contexto encontrado no código (pontos exatos a alterar)
- `index.html`
  - `<title>Lovable App</title>`
  - `<meta name="description" content="Lovable Generated Project" />`
  - `<meta name="author" content="Lovable" />`
  - `og:title`, `og:description`, `twitter:*` ainda com “Lovable”.
- `src/components/layout/AppSidebar.tsx`
  - Texto atual no label: “ERP Estoque”.
- `src/pages/Auth.tsx`
  - Título atual: “ERP • Estoque”.
  - Subtítulo “Acesse para gerenciar produtos e movimentações.” (ok, mas podemos ajustar para remover a marca antiga e padronizar com Nexo ERP).

Implementação (passo a passo)

1) Atualização textual (meta e títulos)
Arquivo: `index.html`
- Alterar:
  - `<title>` para: `Nexo ERP | Gestão Inteligente`
  - `meta name="description"` para: `Nexo ERP | Gestão Inteligente`
  - `meta name="author"` para: `Nexo ERP`
  - `meta property="og:title"` para: `Nexo ERP | Gestão Inteligente`
  - `meta property="og:description"` para: `Nexo ERP | Gestão Inteligente`
- Opcional (recomendado para consistência de brand):
  - Atualizar `twitter:site` (hoje está `@Lovable`) para remover branding do Lovable (ou remover a tag se não houver @ oficial).
  - Atualizar `og:image` / `twitter:image` (hoje é do Lovable) — como você não forneceu um novo “opengraph image”, vou planejar deixar como está por enquanto, mas marcar como próximo passo sugerido (para não publicar com imagem da Lovable em compartilhamentos).

Observação técnica:
- Isso cobre o “Browser Title” e “tags <meta>” de forma estática (SPA). Não vamos adicionar bibliotecas extras (ex.: react-helmet) para não aumentar complexidade sem necessidade.

2) Implementação do logotipo na Sidebar (substituir texto)
Arquivo: `src/components/layout/AppSidebar.tsx`
- Onde hoje existe:
  - `<span ...>ERP Estoque</span>`
- Substituir por um `<img>` com a URL informada:
  - `src="https://lesmncgjcvguyizzjvrw.supabase.co/storage/v1/object/public/branding/nexo_erp_logo.jpg"`
  - `alt="Nexo ERP"`
- Ajuste de tamanho:
  - Largura alvo ~140px no modo expandido.
  - Tailwind sugerido: `w-[140px] h-auto object-contain`
- Comportamento quando a sidebar estiver “collapsed”:
  - Como no modo colapsado o espaço é pequeno, vamos:
    - ocultar a imagem para não “estourar” layout (`collapsed && "sr-only"` não funciona para imagem do mesmo jeito).
    - manter acessibilidade: renderizar a imagem com `className={cn("...", collapsed && "hidden")}` e adicionar um `span` com `sr-only` para o texto “Nexo ERP” (ou manter `alt` + `aria-label` no container).
- Ajustes de contraste/transparência:
  - Adicionar classes leves para o logo não “sumir” em glass/escuro:
    - `drop-shadow-sm`
    - `dark:brightness-110 dark:contrast-110` (só se necessário após ver no preview)
  - Não mexer nas variáveis de cor do design system.

3) Implementação do logotipo na Tela de Login (substituir título)
Arquivo: `src/pages/Auth.tsx`
- Onde hoje existe o bloco:
  - `<h1>ERP • Estoque</h1>` e o parágrafo abaixo.
- Substituir por:
  - Uma área centralizada com o logo acima do Card, tamanho maior (180–200px):
    - `<img ... className="mx-auto w-[200px] max-w-full h-auto object-contain" />`
  - Texto auxiliar pode permanecer (mas sem marca antiga), por exemplo:
    - “Acesse para gerenciar produtos, estoque e movimentações.”
- Garantir alinhamento e espaçamento:
  - Manter `mb-6` (ou ajustar para o logo ficar harmônico com o Card).
- Garantir legibilidade com transparência:
  - Mesmas classes de suporte do logo (drop-shadow / dark brightness) aplicadas no login também.

4) Substituir nomes genéricos em “rodapés/mensagens de sistema”
Escopo real encontrado:
- Não encontrei rodapé específico nem outros textos “Lovable App” no `src/` além de `Auth.tsx` e `AppSidebar.tsx`.
- Implementação:
  - Atualizar os textos já identificados.
  - Rodar uma busca (no momento de implementação) por termos comuns (“Lovable”, “ERP Estoque”, “ERP • Estoque”) para garantir que não ficou nenhum ponto restante em páginas como Dashboard/NotFound e componentes.

Checklist de validação (end-to-end)
- Abrir a aplicação e confirmar no navegador:
  - Título da aba: “Nexo ERP | Gestão Inteligente”
  - Meta tags atualizadas (via DevTools > Elements > head).
- Sidebar:
  - Logo aparece com largura ~140px, bem alinhado no glass-sidebar.
  - Sidebar colapsada não quebra layout (logo não “vaza”).
- Login:
  - Logo aparece centralizado acima do Card, com ~180–200px, sem distorção.
  - Em Dark Mode, logo continua legível.
- Regressão visual:
  - Paleta Esmeralda/Slate e glassmorphism permanecem iguais.

Arquivos que serão alterados
- `index.html`
- `src/components/layout/AppSidebar.tsx`
- `src/pages/Auth.tsx`

Riscos/observações
- A URL do logo é externa (Supabase Storage público). Se houver qualquer bloqueio/CORS/404, a imagem não renderiza. Planejo adicionar `loading="eager"` no login (para evitar “flash” vazio) e `loading="lazy"` na sidebar (opcional).
- As tags `og:image`/`twitter:image` ainda apontam para a imagem padrão da Lovable. Para branding completo em compartilhamento de links, precisaremos de uma imagem OG oficial (próximo passo).
