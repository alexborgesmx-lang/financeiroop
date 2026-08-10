# Entrada Mínima Dinâmica + Assumir Risco na Renegociação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o piso fixo de R$200 na entrada da renegociação por um mínimo calculado por contrato (juros da parcela mais próxima em aberto), e adicionar uma opção explícita para o Alex dispensar esse mínimo — inclusive renegociando sem nenhuma entrada, executando na hora sem passar pelo fluxo de PIX.

**Architecture:** `gerarPropostaRenegociacao` (GAS) calcula o mínimo a partir de `saldo.parcAbertas` (já retornado por `_saldoDevedorAbertoContrato`) em vez de ler `CONFIGURACOES.RENEGOCIACAO_ENTRADA_MINIMA`, e aceita uma flag `assumirRisco` que pula a checagem do mínimo (mas nunca aceita entrada ≤ 0 — isso permanece bloqueado ali, pois gerar PIX de R$0 não faz sentido). No frontend, `RenegociacaoModal` ganha uma checkbox "assumir o risco"; quando marcada e a entrada fica em R$0, o componente pula a etapa de proposta/PIX e chama a action `renegociarContrato` diretamente — função que já existe, já é genérica (não depende de uma proposta pendente) e já está deployada, então nenhuma mudança nela é necessária.

**Tech Stack:** React 18 (JSX puro, sem TypeScript) + Vite no frontend; Google Apps Script no backend. Sem framework de testes automatizados no projeto — verificação de sintaxe via `npm run build`, verificação da action nova/alterada via `curl` contra o Web App do GAS, verificação funcional manual no navegador, conforme protocolo Tier 3 do `CLAUDE.md` do projeto (mudança em `appscript.gs` + regra de crédito).

## Global Constraints

- Entrada continua obrigatoriamente > R$0 para gerar um PIX — `assumirRisco` só remove o piso mínimo, nunca permite `valorEntrada <= 0` em `gerarPropostaRenegociacao`.
- Limite de 1 renegociação por contrato (`_validarElegibilidadeRenegociacao`) continua valendo nos dois caminhos (com PIX e sem entrada) — não tocar nessa função.
- Bloqueio de `valorEntrada >= saldoTotalContrato` ("use Quitação Antecipada") continua valendo mesmo com `assumirRisco` — não remover esse `throw`.
- `renegociarContrato` (`appscript.gs:2711`) não é modificada — já aceita `valorEntradaRecebida` opcional e já revalida elegibilidade/saldo por conta própria.
- Sem colunas novas no Sheets, sem abas novas.
- Sem comentários novos no código (convenção do projeto: código autodocumentado).
- Commits em português, prefixo `feat:`.
- Depois de editar `appscript.gs`: abrir TextEdit com o arquivo e instruir o usuário a colar no editor do Google Apps Script e publicar nova versão do Web App — nunca só o trecho alterado.
- Antes de `vercel deploy --prod`: rodar a skill `ultrareview-financeiroop` (Tier 3, conforme `CLAUDE.md` — mudança em `appscript.gs` + regra de crédito/cálculo financeiro).

---

## Task 1: Backend — mínimo dinâmico + flag `assumirRisco` em `gerarPropostaRenegociacao`

**Files:**
- Modify: `appscript.gs:688-690` (remove `_garantirConfigEntradaRenegociacao`)
- Modify: `appscript.gs:737-741` (cálculo do mínimo + flag `assumirRisco`)
- Modify: `appscript.gs:1067` (remove item de menu órfão)

**Interfaces:**
- Produces: `gerarPropostaRenegociacao(dados)` passa a aceitar `dados.assumirRisco: boolean` (opcional, default `false`). Resposta em erro de mínimo não atingido muda de texto (mensagem inclui "juros do mes deste contrato" em vez de valor fixo) — consumida pela Task 2 só para exibição de `msg.t`, nenhum código depende do texto exato.

- [ ] **Step 1: Remover `_garantirConfigEntradaRenegociacao` (não tem mais uso depois desta mudança)**

Código atual (`appscript.gs:688-690`):
```js
function _garantirConfigEntradaRenegociacao() {
  if (!_getCfg("RENEGOCIACAO_ENTRADA_MINIMA")) _setCfg("RENEGOCIACAO_ENTRADA_MINIMA", 200);
}
```

Remover essas 3 linhas por completo (deixar só uma linha em branco entre `_garantirTabelaPropostasRenegociacao` e `_txidRenegociacaoEntrada`, igual ao espaçamento do resto do arquivo).

- [ ] **Step 2: Trocar o cálculo do mínimo fixo pelo dinâmico + flag `assumirRisco`**

Código atual (`appscript.gs:737-741`, dentro de `gerarPropostaRenegociacao`, logo depois de `var jurosEmAberto = saldo.jurosEmAberto;`):
```js
  var entradaMinima = parseFloat(_getCfg("RENEGOCIACAO_ENTRADA_MINIMA")) || 200;
  var valorEntrada  = parseFloat(dados.valorEntrada) || 0;
  if (valorEntrada < entradaMinima) {
    throw new Error("Entrada minima de R$ " + entradaMinima.toFixed(2) + " nao atingida.");
  }
```

Substituir por:
```js
  var parcelaMaisProxima = null;
  for (var pIdx = 0; pIdx < saldo.parcAbertas.length; pIdx++) {
    var pCand = saldo.parcAbertas[pIdx];
    if (!parcelaMaisProxima || pCand.num < parcelaMaisProxima.num) parcelaMaisProxima = pCand;
  }
  var entradaMinima = parcelaMaisProxima ? parcelaMaisProxima.juros : 0;
  var valorEntrada  = parseFloat(dados.valorEntrada) || 0;
  var assumirRisco  = dados.assumirRisco === true;
  if (valorEntrada <= 0) {
    throw new Error("Entrada deve ser maior que zero — para renegociar sem entrada, use a opcao dedicada (sem PIX).");
  }
  if (!assumirRisco && valorEntrada < entradaMinima) {
    throw new Error("Entrada minima de R$ " + entradaMinima.toFixed(2) + " (juros do mes deste contrato) nao atingida.");
  }
```

O restante da função (`saldoTotalContrato`, bloqueio de entrada cobrindo o saldo total, alocação capital/juros, cálculo de `qtdSugerida`/`valorParcelaFinal`) não muda.

- [ ] **Step 3: Remover o item de menu órfão**

Código atual (`appscript.gs:1066-1068`):
```js
    .addItem("Renegociacao: Criar Aba PROPOSTAS_RENEGOCIACAO (rodar 1x)", "_garantirTabelaPropostasRenegociacao")
    .addItem("Renegociacao: Configurar Entrada Minima R$200 (rodar 1x)", "_garantirConfigEntradaRenegociacao")
    .addItem("Renegociacao: Verificar Propostas Expiradas", "verificarPropostasRenegociacaoExpiradas")
```

Substituir por (remove só a linha do meio):
```js
    .addItem("Renegociacao: Criar Aba PROPOSTAS_RENEGOCIACAO (rodar 1x)", "_garantirTabelaPropostasRenegociacao")
    .addItem("Renegociacao: Verificar Propostas Expiradas", "verificarPropostasRenegociacaoExpiradas")
```

- [ ] **Step 4: Conferir que não sobrou nenhuma referência a `RENEGOCIACAO_ENTRADA_MINIMA` nem a `_garantirConfigEntradaRenegociacao`**

```bash
grep -n "RENEGOCIACAO_ENTRADA_MINIMA\|_garantirConfigEntradaRenegociacao" /Users/alexborges/financeiroop/appscript.gs
```

Esperado: nenhuma saída.

- [ ] **Step 5: Abrir o arquivo completo no TextEdit pra colar no editor do Apps Script**

```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```

Instruir o usuário: **Cmd+A → Cmd+C → colar no editor do Google Apps Script → publicar nova versão do Web App.** O GAS exige o arquivo completo, nunca só o trecho alterado. Aguardar confirmação do usuário de que a nova versão foi publicada antes do próximo step.

- [ ] **Step 6: Verificar a mensagem de erro do novo mínimo dinâmico contra um contrato real**

Escolher um `ID_CONTRATO` elegível para renegociação (status ativo/ativo_em_dia/ativo_em_atraso/em_cobranca/pre_prejuizo/acordo_assistido, nunca renegociado antes) e testar com entrada propositalmente baixa (R$1):

```bash
curl -sL -X POST "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec" -H "Content-Type: application/json" -d '{"action":"gerarPropostaRenegociacao","dados":{"idContrato":"<ID_CONTRATO_REAL>","novaValorParcelaDesejada":100,"novoVencimento":"2026-09-10","valorEntrada":1}}'
```

Esperado: `{"erro":"Entrada minima de R$ <valor calculado> (juros do mes deste contrato) nao atingida."}` — confirma que o cálculo dinâmico está rodando (o valor não deve ser 200,00 fixo, deve bater com o `VALOR_JUROS` da parcela mais próxima em aberto desse contrato, visível na aba PARCELAS).

- [ ] **Step 7: Verificar que `assumirRisco:true` libera a mesma entrada baixa**

```bash
curl -sL -X POST "https://script.google.com/macros/s/AKfycbynQKpafDbaBTT-jqs4nCSzbbx8A72MAqDyGxwy86lIt0ykZxeFT8IdlO7zjj0rJEHy7Q/exec" -H "Content-Type: application/json" -d '{"action":"gerarPropostaRenegociacao","dados":{"idContrato":"<ID_CONTRATO_REAL>","novaValorParcelaDesejada":100,"novoVencimento":"2026-09-10","valorEntrada":1,"assumirRisco":true}}'
```

Esperado: `{"ok":true,...}` com uma proposta criada (ou a proposta pendente já existente devolvida, se o Step 6 já tiver deixado uma `PENDENTE` por engano — nesse caso, cancelar via `cancelarPropostaRenegociacao` antes de repetir o teste). **Atenção:** isso cria uma proposta PENDENTE real em `PROPOSTAS_RENEGOCIACAO` — usar um contrato de teste ou cancelar a proposta logo depois (`{"action":"cancelarPropostaRenegociacao","dados":{"idContrato":"<ID_CONTRATO_REAL>","idCliente":"...","nomeCliente":"..."}}`) pra não deixar lixo de teste no banco.

- [ ] **Step 8: Commit**

```bash
git add appscript.gs
git commit -m "feat: entrada minima dinamica (juros do mes) + flag assumirRisco na renegociacao

Substitui o piso fixo de R\$200 por um minimo calculado por contrato."
```

---

## Task 2: Frontend — checkbox "assumir risco" e caminho sem entrada no `RenegociacaoModal`

**Files:**
- Modify: `src/main.jsx:2654` (estado inicial de `entrada` e novo estado `assumirRisco`)
- Modify: `src/main.jsx:2682-2689` (mínimo dinâmico + duas validações de `canSubmit`)
- Modify: `src/main.jsx:2710-2725` (`gerarPix` envia `assumirRisco`)
- Modify: `src/main.jsx:2761` (nova função `renegociarSemEntrada`, logo após `gerarPix`)
- Modify: `src/main.jsx:2898-2899` (campo Entrada — placeholder dinâmico + texto de apoio)
- Modify: `src/main.jsx:2905` (checkbox nova, logo abaixo da grid de campos)
- Modify: `src/main.jsx:2912` (preview de parcelamento passa a considerar entrada R$0)
- Modify: `src/main.jsx:2944-2954` (rodapé: botão alterna entre "Gerar PIX" e "Renegociar sem entrada")

**Interfaces:**
- Consumes: action `gerarPropostaRenegociacao` (Task 1, agora aceita `assumirRisco`); action `renegociarContrato` (já existe, `appscript.gs:2711`, exposta em `doPost` — `{ok, parcelas, idContrato, idCliente, parcelasEncerradas, totalRenegociado}` em sucesso, `{erro}` em falha); `postAction` (`src/main.jsx`, já em uso no arquivo); `onConfirmar` (prop já recebida pelo componente, hoje sem uso — vai fechar o modal e recarregar dados após a renegociação sem entrada).
- Produces: nenhuma interface nova consumida por outro componente — `RenegociacaoModal` continua sendo usado só por si mesmo (`src/main.jsx:8692`).

- [ ] **Step 1: Trocar o valor inicial de `entrada` e adicionar o estado `assumirRisco`**

Código atual (`src/main.jsx:2654`):
```js
  const [entrada, setEntrada]         = useState("200");
```

Substituir por:
```js
  const [entrada, setEntrada]         = useState("");
  const [assumirRisco, setAssumirRisco] = useState(false);
```

- [ ] **Step 2: Calcular o mínimo dinâmico e as duas validações de `canSubmit`**

Código atual (`src/main.jsx:2682-2689`):
```js
  const entradaNum       = parseFloat(entrada)||0;
  const valorDesejadoNum = parseFloat(valorDesejado)||0;
  const entradaSobreCapital = Math.min(entradaNum, capitalFaltante);
  const entradaSobreJuros   = Math.min(Math.max(0, entradaNum - entradaSobreCapital), jurosEmAberto);
  const saldoRestante    = Math.max(0, (capitalFaltante-entradaSobreCapital) + (jurosEmAberto-entradaSobreJuros));
  const qtdSugerida      = valorDesejadoNum>0 ? Math.max(1, Math.ceil(saldoRestante/valorDesejadoNum)) : 0;
  const valorParcelaFinal= qtdSugerida>0 ? Math.ceil(saldoRestante/qtdSugerida) : 0;
  const canSubmit         = entradaNum>0 && entradaNum<saldoTotal && valorDesejadoNum>0 && !!novoVencimento;
```

Substituir por:
```js
  const entradaMinima    = abertas.length>0 ? parseFloat(abertas[0].VALOR_JUROS||0) : 0;
  const entradaNum       = parseFloat(entrada)||0;
  const valorDesejadoNum = parseFloat(valorDesejado)||0;
  const entradaSobreCapital = Math.min(entradaNum, capitalFaltante);
  const entradaSobreJuros   = Math.min(Math.max(0, entradaNum - entradaSobreCapital), jurosEmAberto);
  const saldoRestante    = Math.max(0, (capitalFaltante-entradaSobreCapital) + (jurosEmAberto-entradaSobreJuros));
  const qtdSugerida      = valorDesejadoNum>0 ? Math.max(1, Math.ceil(saldoRestante/valorDesejadoNum)) : 0;
  const valorParcelaFinal= qtdSugerida>0 ? Math.ceil(saldoRestante/qtdSugerida) : 0;
  const entradaAtendeMinimo = assumirRisco || entradaNum>=entradaMinima;
  const semEntrada        = assumirRisco && entradaNum<=0;
  const canSubmitPix       = !semEntrada && entradaNum>0 && entradaAtendeMinimo && entradaNum<saldoTotal && valorDesejadoNum>0 && !!novoVencimento;
  const canSubmitSemEntrada= semEntrada && valorDesejadoNum>0 && !!novoVencimento;
```

- [ ] **Step 3: `gerarPix` passa a enviar `assumirRisco` e a checar `canSubmitPix`**

Código atual (`src/main.jsx:2710-2725`):
```js
  const gerarPix = async () => {
    if(!canSubmit){
      setMsg({ok:false,t:"Preencha a entrada e o valor de parcela desejado pelo cliente."});
      return;
    }
    setLoading(true);setMsg(null);

    const resP = await postAction({action:"gerarPropostaRenegociacao",dados:{
      idContrato:               contrato.ID_CONTRATO,
      idCliente:                contrato.ID_CLIENTE,
      nomeCliente:               contrato.NOME_CLIENTE,
      valorEntrada:              entradaNum,
      novaValorParcelaDesejada:  valorDesejadoNum,
      novoVencimento,
      observacao
    }});
```

Substituir por:
```js
  const gerarPix = async () => {
    if(!canSubmitPix){
      setMsg({ok:false,t:"Preencha a entrada e o valor de parcela desejado pelo cliente."});
      return;
    }
    setLoading(true);setMsg(null);

    const resP = await postAction({action:"gerarPropostaRenegociacao",dados:{
      idContrato:               contrato.ID_CONTRATO,
      idCliente:                contrato.ID_CLIENTE,
      nomeCliente:               contrato.NOME_CLIENTE,
      valorEntrada:              entradaNum,
      novaValorParcelaDesejada:  valorDesejadoNum,
      novoVencimento,
      observacao,
      assumirRisco
    }});
```

(o restante do corpo de `gerarPix`, a partir de `if(!resP.ok){...`, não muda)

- [ ] **Step 4: Adicionar `renegociarSemEntrada`, logo depois do fim de `gerarPix` (depois da linha `};` que fecha `gerarPix`, `src/main.jsx:2761`)**

```js
  const renegociarSemEntrada = async () => {
    if(!canSubmitSemEntrada){
      setMsg({ok:false,t:"Preencha o valor de parcela desejado e a data do novo carnê."});
      return;
    }
    if(!window.confirm("Renegociar SEM entrada, assumindo o risco? As parcelas antigas serão encerradas e um novo carnê será criado imediatamente. Essa ação não pode ser desfeita.")) return;
    setLoading(true);setMsg(null);
    const res = await postAction({action:"renegociarContrato",dados:{
      idContrato:        contrato.ID_CONTRATO,
      novaValorParcela:  valorParcelaFinal,
      novasParcelasQtd:  qtdSugerida,
      novoVencimento,
      observacao:        "[SEM ENTRADA - RISCO ASSUMIDO] " + observacao
    }});
    setLoading(false);
    if(res.ok){ onConfirmar&&onConfirmar(); }
    else { setMsg({ok:false,t:res.erro||"Erro ao renegociar."}); }
  };
```

- [ ] **Step 5: Campo Entrada — placeholder dinâmico + texto de apoio**

Código atual (`src/main.jsx:2897-2900`):
```js
                  <div>
                    <label style={LS()}>Entrada (R$)</label>
                    <input type="number" value={entrada} onChange={e=>setEntrada(e.target.value)} onPaste={e=>pasteMoeda(e,setEntrada)} placeholder="200,00" min="0" step="0.01" style={IS()}/>
                  </div>
```

Substituir por:
```js
                  <div>
                    <label style={LS()}>Entrada (R$)</label>
                    <input type="number" value={entrada} onChange={e=>setEntrada(e.target.value)} onPaste={e=>pasteMoeda(e,setEntrada)} placeholder={entradaMinima>0?entradaMinima.toFixed(2):"0,00"} min="0" step="0.01" style={IS()}/>
                    <div style={{fontSize:10,color:assumirRisco?MUTED:(entradaNum>0&&!entradaAtendeMinimo?RED:MUTED),marginTop:4}}>
                      {assumirRisco?"Sem mínimo — deixe em branco para renegociar sem entrada.":`Mínimo sugerido: ${fmtR(entradaMinima)} (juros do mês deste contrato)`}
                    </div>
                  </div>
```

- [ ] **Step 6: Checkbox "assumir o risco", logo depois da grid de Entrada/Valor desejado (depois do `</div>` que fecha a grid, antes do campo de Data do 1º vencimento, `src/main.jsx:2905`)**

Código atual (`src/main.jsx:2905-2909`):
```js
                </div>
                <div>
                  <label style={LS()}>Data do 1º vencimento (novo carnê)</label>
                  <input type="date" value={novoVencimento} onChange={e=>setNovoVencimento(e.target.value)} style={IS()}/>
                </div>
```

Substituir por:
```js
                </div>
                <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:TEXT,cursor:"pointer"}}>
                  <input type="checkbox" checked={assumirRisco} onChange={e=>setAssumirRisco(e.target.checked)} style={{width:16,height:16,accentColor:RED}}/>
                  Assumir o risco e dispensar a entrada mínima
                </label>
                <div>
                  <label style={LS()}>Data do 1º vencimento (novo carnê)</label>
                  <input type="date" value={novoVencimento} onChange={e=>setNovoVencimento(e.target.value)} style={IS()}/>
                </div>
```

- [ ] **Step 7: Preview de parcelamento passa a considerar entrada R$0 (caminho sem entrada)**

Código atual (`src/main.jsx:2912`):
```js
              {entradaNum>0&&valorDesejadoNum>0&&(
```

Substituir por:
```js
              {(entradaNum>0||semEntrada)&&valorDesejadoNum>0&&(
```

- [ ] **Step 8: Rodapé — botão alterna entre "Gerar PIX da Entrada" e "Renegociar sem entrada"**

Código atual (`src/main.jsx:2944-2954`):
```js
          {view==="form"?(
            <>
              {entradaNum>0&&valorDesejadoNum>0&&(
                <button onClick={enviarPropostaWpp} style={{...BTN2(false),flex:"0 0 auto",padding:"13px 16px",fontSize:13}}>
                  {IcoWpp} Proposta WPP
                </button>
              )}
              <button onClick={gerarPix} disabled={loading||!canSubmit} style={{...BTN1(!canSubmit||loading),flex:1}}>
                {loading?<><IcoSpinner size={12}/> Gerando PIX...</>:<>{IcoRepeat} Gerar PIX da Entrada</>}
              </button>
            </>
          ):(
```

Substituir por:
```js
          {view==="form"?(
            <>
              {entradaNum>0&&valorDesejadoNum>0&&(
                <button onClick={enviarPropostaWpp} style={{...BTN2(false),flex:"0 0 auto",padding:"13px 16px",fontSize:13}}>
                  {IcoWpp} Proposta WPP
                </button>
              )}
              {semEntrada?(
                <button onClick={renegociarSemEntrada} disabled={loading||!canSubmitSemEntrada} style={{...BTN1(!canSubmitSemEntrada||loading),flex:1,background:(!canSubmitSemEntrada||loading)?undefined:RED}}>
                  {loading?<><IcoSpinner size={12}/> Renegociando...</>:<>{IcoAlert} Renegociar sem entrada</>}
                </button>
              ):(
                <button onClick={gerarPix} disabled={loading||!canSubmitPix} style={{...BTN1(!canSubmitPix||loading),flex:1}}>
                  {loading?<><IcoSpinner size={12}/> Gerando PIX...</>:<>{IcoRepeat} Gerar PIX da Entrada</>}
                </button>
              )}
            </>
          ):(
```

- [ ] **Step 9: Verificar sintaxe com build local**

```bash
cd /Users/alexborges/financeiroop && npm run build
```

Esperado: build conclui sem erro (mesmo output de sempre, `dist/` gerado, sem exceção de parsing).

- [ ] **Step 10: Commit**

```bash
git add src/main.jsx
git commit -m "feat: checkbox assumir risco + renegociacao sem entrada no RenegociacaoModal"
```

---

## Task 3: Deploy e verificação Tier 3

**Files:** nenhum (só deploy e teste manual)

- [ ] **Step 1: Rodar a skill de review completa**

Invocar `Skill("ultrareview-financeiroop")` — Tier 3 (mudança em `appscript.gs` + regra de crédito). Corrigir qualquer item CRÍTICO/BLOQUEANTE antes de seguir.

- [ ] **Step 2: Deploy**

```bash
cd /Users/alexborges/financeiroop && vercel deploy --prod
```

- [ ] **Step 3: Teste manual no navegador — caminho normal (com PIX)**

Abrir um contrato elegível para renegociação (nunca renegociado, status ativo/em atraso/em cobrança/pré-prejuízo/acordo assistido) → "Mais Ações" → "Renegociar contrato". Confirmar:
- Texto de apoio abaixo do campo Entrada mostra um valor em R$ (não "R$200,00" fixo) igual ao `VALOR_JUROS` da parcela mais próxima em aberto (conferir na aba PARCELAS ou no `ContratoModal` do mesmo contrato).
- Digitar um valor abaixo desse mínimo, checkbox desmarcada → botão "Gerar PIX da Entrada" desabilitado ou mensagem de erro ao clicar.
- Marcar a checkbox "Assumir o risco..." → texto de apoio muda para "Sem mínimo..." → digitar o mesmo valor baixo → "Gerar PIX da Entrada" habilita e gera o PIX normalmente.

- [ ] **Step 4: Teste manual no navegador — caminho sem entrada**

Em outro contrato elegível (ou cancelando a proposta pendente do teste anterior antes de reusar o mesmo): marcar "Assumir o risco...", deixar o campo Entrada em branco, preencher valor de parcela desejado e data do novo carnê. Confirmar:
- Botão do rodapé vira "Renegociar sem entrada".
- Ao clicar, aparece o `window.confirm` de aviso de irreversibilidade.
- Ao confirmar, a renegociação executa na hora: modal fecha (via `onConfirmar`), o contrato mostra o novo carnê, as parcelas antigas aparecem como `renegociado` no histórico.
- Na aba EVENTOS (ou no `ContratoModal` do contrato), o evento `RENEGOCIACAO_ESTRUTURAL` tem a observação começando com `[SEM ENTRADA - RISCO ASSUMIDO]`.

- [ ] **Step 5: Confirmar ausência de erros de console em ambos os testes**

Sem erros no console do navegador durante os dois fluxos acima.

- [ ] **Step 6: Documentação — `docs/ai-memory/02-AI-CREDIT-RULES.md`**

Atualizar a entrada "Entrada obrigatória como prova de comprometimento (2026-08-06)" (linha 65) acrescentando uma frase sobre a mudança: o mínimo deixou de ser fixo (R$200) e passou a ser dinâmico por contrato (juros da parcela mais próxima em aberto), com opção de dispensa manual ("assumir o risco") — incluindo o caminho sem entrada nenhuma, que pula PIX e executa a renegociação na hora. Referenciar esta data (2026-08-10).

- [ ] **Step 7: Commit da documentação**

```bash
git add docs/ai-memory/02-AI-CREDIT-RULES.md
git commit -m "docs: atualiza regra de entrada minima da renegociacao (dinamica + assumir risco)"
```
