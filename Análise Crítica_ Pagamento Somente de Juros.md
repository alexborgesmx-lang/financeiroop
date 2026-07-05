# Análise Crítica: Pagamento Somente de Juros
## Borges Assessoria — Recomendação Estratégica

**Data:** 19 de junho de 2026  
**Operador:** Alex Borges  
**Contexto:** Financeira informal, capital 100% próprio, ~130 clientes ativos

---

## 1. DIAGNÓSTICO

### Estado Atual
O sistema permite que clientes paguem apenas juros mensais, rolando o principal para uma nova parcela no final do contrato. Tecnicamente funciona, mas **carece de política formalizada e controles**.

**Achados principais:**

| Aspecto | Situação | Impacto |
|---|---|---|
| **Limite de recorrência** | Ilimitado — cliente pode fazer isso todo mês | Alto risco |
| **Taxa adicional** | Não existe — cliente não paga fee de prorrogação | Perda de receita |
| **Score diferenciado** | Não — parcela "paga com somente_juros" conta como adimplência normal | Mascaramento de risco |
| **Controle operacional** | Nenhum — fica a critério do Alex aceitar ou não | Inconsistência |
| **Contabilidade** | Receita reconhecida (correto), mas sem separação de tipo | Falta de visibilidade |
| **Campos resumo do contrato** | Viram médias após somente_juros — valores enganosos | Risco de erro em relatórios |

### Problema Central
**O somente_juros é um mecanismo de "refinanciamento brando" sem custo, sem limite e sem penalização.** Isso cria três dinâmicas perigosas:

1. **Zona de conforto do cliente**: Pagar só juros é mais fácil que pagar a parcela completa. Isso reforça o hábito de adiar o principal.
2. **Deterioração do contrato**: Cada somente_juros adiciona 1 mês ao prazo e R$ (principal × taxa) ao custo total. Um cliente que faz isso 3x em um contrato de 6 parcelas termina pagando por 9 parcelas.
3. **Risco de inadimplência**: Cliente acostumado a "pagar só juros" pode, no mês seguinte, não pagar nem os juros. O sistema não diferencia entre "1º somente_juros" (dificuldade pontual) e "5º somente_juros seguido" (padrão de risco).

---

## 2. RISCOS

### Risco 1: Deterioração Progressiva da Carteira
**Severidade:** 🔴 CRÍTICA

Se 20% da base (26 clientes) usar somente_juros apenas 2x por contrato:
- Adiciona ~52 parcelas extras ao sistema
- Estende prazos em 2 meses por contrato
- Aumenta exposição ao risco de inadimplência em período estendido
- Reduz velocidade de rotação do capital

**Cenário pessimista:** Cliente faz somente_juros todo mês = nunca reduz o principal = contrato vira "perpetuidade de juros" até quebra.

---

### Risco 2: Mascaramento de Risco no Score
**Severidade:** 🔴 CRÍTICA

Parcela paga com somente_juros marca a parcela como `STATUS = "pago"` → conta como adimplência no score. Problema:
- Cliente com 5 somente_juros seguidos tem score alto (todas as parcelas "pagas")
- Mas o principal nunca foi reduzido — risco real é muito maior
- Quando chegar o mês que não conseguir pagar nem os juros, o default é abrupto

**Impacto:** Score inflado → decisões de crédito futuro baseadas em falsa segurança.

---

### Risco 3: Custo de Oportunidade Não Contabilizado
**Severidade:** 🟠 ALTA

Quando rola o principal, você está:
- Deixando capital imobilizado por mais tempo
- Recebendo juros sobre um saldo que não diminui
- Sem compensação (taxa de prorrogação = 0)

Exemplo: R$ 600 a 18% a.m. em 3x vs. 5x (com 2 somente_juros):
- 3x: você recebe R$ 324 de juros em 3 meses = R$ 108/mês
- 5x: você recebe R$ 540 de juros em 5 meses = R$ 108/mês (MESMO)
- Mas o capital fica 2 meses a mais em risco

**Você não ganha receita extra, mas aumenta exposição.**

---

### Risco 4: Inconsistência Operacional
**Severidade:** 🟠 ALTA

Sem política clara, Alex decide ad hoc:
- Cliente A faz somente_juros 1x → aceita
- Cliente B faz somente_juros 3x → aceita (porque estava de bom humor?)
- Cliente C pede 4ª vez → nega (porque agora ficou preocupado)

Resultado: Clientes percebem arbitrariedade → reclamação, desconfiança, possível disputa.

---

### Risco 5: Deterioração da Relação Cliente-Contrato
**Severidade:** 🟡 MÉDIA

Somente_juros é uma "muleta" que adia o problema. Cliente que usa:
- Aprende que pode sempre pedir extensão
- Não se força a reorganizar finanças
- Cria expectativa de "flexibilidade permanente"
- Quando você nega a 4ª vez, fica ressentido

Isso reduz a qualidade da relação e aumenta risco de default intencional.

---

### Risco 6: Distorção nos Campos de Resumo do Contrato
**Severidade:** 🟡 MÉDIA

Após somente_juros, `VALOR_PARCELA`, `PARCELA_PRINCIPAL` e `PARCELA_JUROS` viram médias (não valores reais). Se você usar esses campos para:
- Gerar relatórios automáticos
- Atualizar documento do contrato
- Fazer projeções de caixa

Você terá números errados.

---

## 3. ALTERNATIVAS

### Opção A: Remover Somente_Juros Completamente
**Implementação:** Desabilitar a opção na UI, bloquear no GAS, comunicar aos clientes.

**Prós:**
- Elimina todos os riscos acima
- Força cliente a se reorganizar ou entrar em acordo formal
- Simplifica operação e score
- Reduz confusão de campos de resumo

**Contras:**
- Pode aumentar inadimplência de curto prazo (clientes que não conseguem pagar parcela completa)
- Pode gerar atrito com clientes que já usavam
- Perde a "válvula de escape" para dificuldades pontuais

**Quando usar:** Se você quer ser rigoroso e forçar disciplina financeira.

---

### Opção B: Manter, Mas Com Controles Rigorosos
**Implementação:** Formalizar política com 5 mudanças.

**Mudança 1 — Limite de Recorrência**
- Máximo 2 somente_juros por contrato
- Após 2x, cliente deve fazer acordo formal ou pagar parcela completa
- Sistema bloqueia a 3ª tentativa com mensagem clara

**Mudança 2 — Taxa de Prorrogação**
- Cobrar fee de 5% a 10% sobre o principal rolado
- Exemplo: cliente paga R$ 108 (juros) + R$ 10 (fee) = R$ 118
- Isso compensa o custo de oportunidade e desestimula uso repetido

**Mudança 3 — Penalização no Score**
- Cada somente_juros reduz score em 10 pontos (ex: 75 → 65)
- Penalização acumulativa: 1º somente_juros = -10, 2º = -20 total
- Isso reflete o risco real e impede futuros créditos com score baixo

**Mudança 4 — Alerta Operacional**
- Quando cliente faz 1º somente_juros: aviso amarelo no dashboard
- Quando faz 2º: aviso vermelho + sugestão de acordo formal
- Contador `TOTAL_SOMENTE_JUROS` no registro do contrato

**Mudança 5 — Contabilidade Separada**
- Linha separada no financeiro: "Receita de Prorrogação (somente_juros)"
- Permite análise de quanto dessa receita é "receita de risco" vs. "receita normal"

**Prós:**
- Mantém flexibilidade para dificuldades pontuais
- Compensa custo de oportunidade
- Reduz risco de abuso
- Força cliente a pensar antes de usar
- Melhora visibilidade financeira

**Contras:**
- Mais complexo de implementar
- Cliente pode ficar insatisfeito com fee
- Requer comunicação clara sobre nova política

**Quando usar:** Se você quer equilibrio entre flexibilidade e proteção.

---

### Opção C: Transformar em "Acordo de Prorrogação Formal"
**Implementação:** Remover somente_juros automático, criar fluxo de acordo formal.

**Como funciona:**
1. Cliente em dificuldade solicita prorrogação
2. Alex cria um "Acordo de Prorrogação" (documento formal)
3. Acordo especifica: quantas vezes, taxa de prorrogação, condições
4. Cliente assina (como faz com contrato original)
5. Sistema registra como "acordo_prorrogacao" (não somente_juros)

**Prós:**
- Mais profissional e formal
- Deixa claro que é uma concessão, não direito
- Permite termos customizados por cliente
- Reduz risco legal (está tudo documentado)
- Força conversação entre Alex e cliente

**Contras:**
- Mais burocrático
- Requer documento adicional (ZapSign)
- Mais lento que somente_juros rápido

**Quando usar:** Se você quer formalizar e profissionalizar a operação.

---

## 4. MELHOR SOLUÇÃO

**Recomendação: Opção B com ajustes.**

### Por quê?

1. **Você não quer perder a válvula de escape** (Opção A é muito rígida)
2. **Você quer profissionalizar, mas não burocratizar** (Opção C é excessiva para sua escala)
3. **Você precisa de proteção real** (Opção B oferece controles sem perder flexibilidade)

### Implementação Recomendada

**Fase 1 — Política Formalizada (Semana 1)**
Documento interno com regras claras:
- Máximo 2 somente_juros por contrato
- Taxa de prorrogação de 7% sobre principal rolado
- Penalização de score: -10 pontos por somente_juros
- Comunicar aos clientes (via WhatsApp/email)

**Fase 2 — Ajustes Técnicos (Semana 2-3)**
- Adicionar contador `TOTAL_SOMENTE_JUROS` no CONTRATOS
- Bloquear 3º somente_juros com mensagem clara
- Implementar penalização de score
- Criar campo `TAXA_PRORROGACAO` na parcela gerada

**Fase 3 — Contabilidade (Semana 3-4)**
- Linha separada no Financeiro para "Receita de Prorrogação"
- Relatório mensal: quantos somente_juros, quanto de fee arrecadado

**Fase 4 — Monitoramento (Contínuo)**
- Dashboard com clientes que usaram somente_juros 2x (próximos a limite)
- Alerta para clientes com score reduzido por somente_juros
- Análise trimestral: quantos clientes com 2 somente_juros entraram em default?

---

## 5. PLANO DE IMPLEMENTAÇÃO

### Sprint 1: Política e Comunicação (Dias 1-3)

**Tarefa 1.1 — Definir regras finais**
- [ ] Confirmar limite: 2 somente_juros por contrato? (recomendado: sim)
- [ ] Confirmar taxa de prorrogação: 7%? (recomendado: 5-10%, escolha 7%)
- [ ] Confirmar penalização de score: -10 pontos? (recomendado: sim)
- [ ] Documentar em arquivo interno

**Tarefa 1.2 — Comunicar aos clientes**
- [ ] Preparar mensagem WhatsApp (veja template abaixo)
- [ ] Enviar para todos os clientes ativos
- [ ] Documentar data de implementação

**Tarefa 1.3 — Treinar a si mesmo**
- [ ] Revisar regras diariamente por 1 semana
- [ ] Testar cenários (cliente faz 1º, 2º, 3º somente_juros)
- [ ] Criar checklist pessoal para decisão

---

### Sprint 2: Ajustes Técnicos (Dias 4-10)

**Tarefa 2.1 — Adicionar contador**
- [ ] Coluna `TOTAL_SOMENTE_JUROS` em CONTRATOS
- [ ] Incrementar cada vez que somente_juros é registrado
- [ ] Exibir no ContratoModal

**Tarefa 2.2 — Bloquear 3ª tentativa**
- [ ] Função GAS: se `TOTAL_SOMENTE_JUROS >= 2`, retornar erro
- [ ] UI: mostrar mensagem clara ("Limite de prorrogações atingido")
- [ ] Sugerir acordo formal ou pagamento completo

**Tarefa 2.3 — Penalização de score**
- [ ] Função de score: reduzir -10 pontos por cada somente_juros
- [ ] Acumulativo: 1º = -10, 2º = -20 total
- [ ] Testar com cliente fictício

**Tarefa 2.4 — Campo de taxa de prorrogação**
- [ ] Coluna `TAXA_PRORROGACAO` em PARCELAS (para parcelas geradas)
- [ ] Registrar 7% quando parcela é criada por somente_juros
- [ ] Exibir em relatórios

---

### Sprint 3: Contabilidade (Dias 11-14)

**Tarefa 3.1 — Linha separada no Financeiro**
- [ ] Adicionar filtro "Receita de Prorrogação" na aba Financeiro
- [ ] Exibir total mensal de fees arrecadados
- [ ] Comparar com "Receita Normal"

**Tarefa 3.2 — Relatório mensal**
- [ ] Criar template de relatório: "Somente Juros do Mês"
- [ ] Campos: cliente, contrato, valor de juros, fee, total, score anterior/novo
- [ ] Gerar manualmente (ou automatizar depois)

---

### Sprint 4: Monitoramento (Dias 15+)

**Tarefa 4.1 — Dashboard de risco**
- [ ] Widget: "Clientes próximos ao limite (2 somente_juros)"
- [ ] Widget: "Clientes com score reduzido por somente_juros"
- [ ] Atualizar semanalmente

**Tarefa 4.2 — Análise trimestral**
- [ ] Pergunta: De clientes que usaram 2 somente_juros, quantos entraram em default?
- [ ] Pergunta: Quanto de fee foi arrecadado vs. quanto de risco foi adicionado?
- [ ] Decisão: política está funcionando?

---

## 6. CRITÉRIOS DE VALIDAÇÃO

### Métrica 1: Limite de Recorrência
- ✅ Sistema bloqueia 3º somente_juros
- ✅ Cliente recebe mensagem clara
- ✅ Nenhum contrato com > 2 somente_juros após implementação

### Métrica 2: Taxa de Prorrogação
- ✅ Cada somente_juros registra fee de 7%
- ✅ Fee aparece em PAGAMENTOS com tipo "taxa_prorrogacao"
- ✅ Total de fees arrecadados > 0 no mês

### Métrica 3: Score Diferenciado
- ✅ Cliente com 1 somente_juros tem score -10 vs. baseline
- ✅ Cliente com 2 somente_juros tem score -20 vs. baseline
- ✅ Score penalizado reflete no ContratoModal e ClienteModal

### Métrica 4: Alerta Operacional
- ✅ Dashboard exibe clientes com 2 somente_juros (próximos ao limite)
- ✅ Contador `TOTAL_SOMENTE_JUROS` visível no ContratoModal
- ✅ Aviso amarelo/vermelho aparece quando apropriado

### Métrica 5: Contabilidade Separada
- ✅ Aba Financeiro permite filtrar por "Receita de Prorrogação"
- ✅ Relatório mensal mostra fees arrecadados
- ✅ Diferença entre receita normal e receita de prorrogação é clara

### Métrica 6: Impacto no Risco
- ✅ Após 3 meses: taxa de inadimplência de clientes com somente_juros ≤ taxa geral
- ✅ Nenhum cliente com 2 somente_juros entrou em default sem aviso prévio
- ✅ Fee arrecadado compensa custo de oportunidade

---

## 7. RESPOSTA ÀS PERGUNTAS ESTRATÉGICAS

### A. Estratégia de Negócio

**P1: O modelo somente_juros é saudável?**  
R: Não, sem controles. É uma "muleta" que adia problemas. Com controles (limite + fee + penalização), vira uma ferramenta legítima de flexibilidade.

**P2: Devo cobrar taxa de prorrogação?**  
R: **SIM, obrigatoriamente.** 7% sobre principal rolado. Isso compensa custo de oportunidade e desestimula abuso.

**P3: Limite de somente_juros por contrato?**  
R: **SIM, máximo 2 vezes.** Após 2x, cliente deve fazer acordo formal ou pagar completo.

**P4: Somente_juros deve refletir no score?**  
R: **SIM, penalização de -10 pontos por ocorrência.** Isso reflete risco real.

**P5: Diferença entre somente_juros e renegociação?**  
R: Somente_juros = flexibilidade automática (rápida, sem custo). Renegociação = acordo formal (lento, com termos customizados). Use somente_juros para dificuldades pontuais; renegociação para clientes em risco crônico.

---

### B. Impacto Contábil

**P6: Somente_juros é receita ou receita diferida?**  
R: Receita imediata (juros) + receita de prorrogação (fee). Ambas reconhecidas no mês do recebimento (regime de caixa).

**P7: Custo real do capital imobilizado?**  
R: Use a fórmula: `Custo_Oportunidade = Principal × Taxa_Mensal × Meses_Adicionais`. Exemplo: R$ 600 × 18% × 2 meses = R$ 216. A fee de 7% (R$ 42) é parcial — você ainda perde R$ 174. Mas é melhor que perder tudo em default.

**P8: Linha separada no DRE?**  
R: **SIM.** Crie "Receita de Prorrogação (somente_juros)" separada de "Receita Normal". Permite análise de qualidade de receita.

---

### C. Riscos Operacionais

**P9: Risco de cliente nunca pagar principal?**  
R: Alto, se sem limite. Com limite de 2x, cliente tem máximo 2 meses extras. Se não conseguir pagar em 2 meses, entra em default — você força conversação.

**P10: Somente_juros aumenta inadimplência futura?**  
R: Provavelmente sim (cliente acostuma com adiamento). Mas com penalização de score, você reduz crédito futuro para esse cliente.

**P11: Limitar a clientes com score ≥ 60?**  
R: Boa ideia. Adicione regra: somente_juros permitido apenas se score ≥ 60 antes da aplicação.

---

### D. Implementação Técnica

**P12: Registrar no score que foi somente_juros?**  
R: **SIM.** Campo `TIPO_PAGAMENTO = "somente_juros"` já existe. Use para penalizar score.

**P13: Alerta visual diferente?**  
R: **SIM.** Badge vermelho no Financeiro + aviso no Dashboard quando cliente atinge limite.

**P14: Contador de somente_juros?**  
R: **SIM, crítico.** Campo `TOTAL_SOMENTE_JUROS` em CONTRATOS. Sem ele, você não consegue bloquear 3ª tentativa.

---

## 8. IMPACTO ESTIMADO

### Cenário: Implementar Opção B (Recomendada)

**Curto prazo (1-3 meses):**
- ✅ Reduz risco de deterioração progressiva (limite = proteção)
- ✅ Adiciona receita de fee (~R$ 200-500/mês, dependendo volume)
- ✅ Melhora visibilidade (contador + alerta)
- ⚠️ Alguns clientes podem reclamar de fee (comunique bem)

**Médio prazo (3-6 meses):**
- ✅ Score mais realista (clientes com somente_juros têm score mais baixo)
- ✅ Menos somente_juros repetido (fee + limite desincentivam)
- ✅ Melhor separação contábil (receita de prorrogação visível)
- ⚠️ Possível aumento de inadimplência (cliente que não consegue pagar nem juros)

**Longo prazo (6+ meses):**
- ✅ Carteira mais saudável (menos clientes em "zona de conforto")
- ✅ Melhor previsibilidade de risco
- ✅ Dados para decisão: somente_juros com limite + fee + penalização funciona?

---

## 9. RECOMENDAÇÃO FINAL

### Decisão: MANTER, MAS COM CONTROLES RIGOROSOS (Opção B)

**Razões:**

1. **Você não quer ser rígido demais** — Opção A (remover) eliminaria a válvula de escape para clientes em dificuldade pontual.

2. **Você quer profissionalizar** — Opção B formaliza regras, sem burocratizar como Opção C.

3. **Proteção do patrimônio** — Limite de 2x + fee + penalização de score reduzem risco de deterioração.

4. **Lucro dos contratos** — Fee de 7% compensa parcialmente o custo de oportunidade.

5. **Relação cliente** — Mantém flexibilidade, mas deixa claro que há limite e custo.

### Próximos Passos (Ordem de Prioridade)

1. **Hoje:** Leia este documento novamente, destaque as 5 mudanças principais.
2. **Amanhã:** Defina os números finais (limite, %, penalização) — confirme se concorda com 2x, 7%, -10 pontos.
3. **Dia 3:** Comunique aos clientes via WhatsApp (template abaixo).
4. **Semana 1:** Implemente contador `TOTAL_SOMENTE_JUROS` no Sheets.
5. **Semana 2:** Implemente bloqueio de 3ª tentativa no GAS.
6. **Semana 3:** Implemente penalização de score.
7. **Semana 4:** Implemente contabilidade separada.

---

## 10. TEMPLATE DE COMUNICAÇÃO AO CLIENTE

**Via WhatsApp:**

```
Oi [NOME],

Estamos atualizando nossa política de flexibilidade de pagamentos para melhorar o atendimento.

A partir de [DATA], a opção "Somente Juros" terá as seguintes regras:

✅ Você pode usar até 2 vezes por contrato
✅ Cada uso terá uma taxa de prorrogação de 7% (pequeno custo pela extensão)
✅ Isso ajuda a manter seus juros em dia, mas o principal será rolado

Exemplo: Parcela de R$ 308 (R$ 200 principal + R$ 108 juros)
- Pagando só juros: você paga R$ 108 + R$ 7 (taxa) = R$ 115
- O principal de R$ 200 vira uma nova parcela no final

Isso é uma ferramenta para dificuldades pontuais — não é para usar todo mês.

Qualquer dúvida, é só chamar!

Abraço,
Alex
```

---

## 11. CONCLUSÃO

**Somente_juros não é "errado" — é apenas um mecanismo sem política.**

Com os controles recomendados (limite + fee + penalização), vira uma ferramenta legítima que:
- Protege seu patrimônio (limite + score)
- Aumenta seu lucro (fee)
- Mantém flexibilidade (ainda existe)
- Profissionaliza a operação (regras claras)

**A implementação é viável em 4 semanas com ajustes técnicos moderados.**

Sem esses controles, o risco de deterioração progressiva é real — e você pode acordar em 6 meses com uma carteira onde 30% dos clientes estão em "somente_juros infinito".

---

*Análise concluída: 19 de junho de 2026*
