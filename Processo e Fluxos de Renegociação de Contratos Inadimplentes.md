# Processo e Fluxos de Renegociação de Contratos Inadimplentes
## Diagnóstico, Impactos e Plano de Implementação

Com base nos documentos fornecidos (CLAUDE.md e RENEGOCIACAO-BRIEF.md), elaboramos a análise estrutural para a implementação do fluxo de renegociação no sistema FinanceiroOp.

### 1. Diagnóstico da Situação Atual

O sistema atual carece de uma opção intermediária para clientes inadimplentes. As opções existentes são:
- **Acordo Assistido:** Pausa a cobrança, aceita abatimentos no principal, mas não altera as parcelas nem cria um novo carnê.
- **Acordo com Perda:** Encerra o contrato com desconto definitivo, perdendo o relacionamento e a possibilidade de continuidade de pagamentos parcelados.

**Problema:** Quando um cliente perde capacidade de pagamento do valor original, mas ainda tem intenção de pagar um valor menor, o sistema não permite criar um novo carnê ajustado, aumentando o risco de evasão e perda de capital.

**Solução Proposta:** Implementar a **Renegociação Estrutural**, que permite alterar o valor e a quantidade de parcelas restantes, mantendo o contrato ativo e a régua de cobrança funcionando.

### 2. Análise de Impactos

Conforme as diretrizes, analisamos os impactos em todas as áreas do sistema:

**Impacto Técnico**
- **Frontend (`src/main.jsx`):** Criação do `RenegociacaoModal` com cálculo bidirecional (valor da parcela vs. quantidade) e integração para gerar novos PIX cobv via Efí.
- **Backend (`appscript.gs`):** Nova função `renegociarContrato(dados)` para fechar parcelas antigas (status `renegociado`), criar novas continuando a numeração (para evitar colisão de TXID), e atualizar o contrato.

**Impacto Operacional**
- O operador terá flexibilidade total para definir o valor do acordo e descontos nos juros, com alertas visuais claros se o acordo não cobrir o capital investido.
- A régua automática de cobrança (WhatsApp) e o webhook da Efí Bank continuarão funcionando sem necessidade de alteração, pois as novas parcelas seguirão o padrão existente.

**Impacto Financeiro**
- **Preservação de Capital:** A renegociação prioriza a recuperação do principal. O sistema bloqueará (ou alertará fortemente) acordos que resultem em prejuízo de capital.
- **Receita:** O desconto será aplicado apenas sobre os juros, nunca sobre o principal.

**Impacto em Cobrança**
- As novas parcelas entrarão no fluxo normal de cobrança (D-5, D-1, D0, etc.), mantendo o cliente engajado.

**Impacto em Inadimplência**
- Redução da evasão de clientes com dificuldades temporárias, convertendo inadimplência crônica em fluxo de caixa alongado.

**Impacto em UX**
- O operador terá uma visão clara no modal: Capital Original, Capital Recuperado, Capital Faltante e Simulação das novas parcelas.
- Cálculo automático cruzado facilita a negociação ao vivo com o cliente.

**Impacto em Banco de Dados (Google Sheets)**
- **PARCELAS:** Parcelas antigas marcadas como `renegociado`. Novas parcelas criadas com `NUM_PARCELA` sequencial e `TOTAL_PARCELAS` atualizado em todas.
- **CONTRATOS:** Atualização do `STATUS_CONTRATO` para `ativo_em_dia`, `NUM_PARCELAS` e adição do campo `DATA_RENEGOCIACAO`.
- **EVENTOS:** Registro do evento `RENEGOCIACAO_ESTRUTURAL` para rastreabilidade.

### 3. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Colisão de TXID na Efí Bank | As novas parcelas devem continuar a numeração (`maxNum + 1`), garantindo que o sufixo `P00000X` seja único. |
| Desconto no capital investido | O sistema calculará o `capital_faltante` e aplicará um teto duplo no desconto, permitindo desconto apenas sobre os juros. |
| Múltiplas renegociações | O backend bloqueará a operação se já existir parcela com `ORIGEM_PARCELA = "renegociada"` no contrato. |

### 4. Melhor Solução (Arquitetura)

A solução detalhada no `RENEGOCIACAO-BRIEF.md` é sólida e deve ser seguida:
1. **Frontend:** Modal interativo que exibe o saldo devedor e permite edição do novo valor ou quantidade de parcelas.
2. **Backend:** Função `renegociarContrato` que encerra parcelas antigas e cria novas, garantindo a continuidade da numeração.
3. **Integração:** Geração de novos PIX cobv via `api/efi-charges.js` para as novas parcelas.

### 5. Plano de Implementação

**Fase 1: Backend (Google Apps Script)**
1. Criar função `renegociarContrato(dados)` em `appscript.gs`.
2. Implementar validações (contrato ativo, não renegociado anteriormente).
3. Lógica de alteração de status das parcelas abertas para `renegociado`.
4. Criação das novas parcelas com numeração sequencial.
5. Atualização do contrato e registro no log de eventos.
6. Adicionar o `case "renegociarContrato"` no `doPost()`.

**Fase 2: Frontend (React)**
1. Criar o componente `RenegociacaoModal` em `src/main.jsx`.
2. Implementar os cálculos de saldo, teto de desconto e cálculo cruzado (valor vs. quantidade).
3. Adicionar o botão "Renegociar" no `ContratoModal` (apenas para contratos elegíveis).

**Fase 3: Integração e Testes**
1. Conectar o modal à action `renegociarContrato`.
2. Após sucesso, chamar `/api/efi-charges` para gerar os PIX das novas parcelas.
3. Salvar os TXIDs no banco via `salvarCobrancasEfi`.
4. Testar o fluxo completo em um contrato de teste.

### 6. Critérios de Validação

- [ ] Contrato renegociado não permite nova renegociação.
- [ ] Parcelas antigas estão com status `renegociado` e não aparecem na cobrança.
- [ ] Novas parcelas foram criadas com numeração sequencial correta.
- [ ] O total de parcelas foi atualizado em todas as linhas do contrato.
- [ ] PIX cobv foram gerados com sucesso na Efí Bank para as novas parcelas.
- [ ] O webhook identifica corretamente o pagamento de uma parcela renegociada.
- [ ] O modal alerta se o valor do acordo for menor que o capital faltante.
