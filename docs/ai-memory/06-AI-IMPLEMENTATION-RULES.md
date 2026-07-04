# IMPLEMENTAÇÃO

Antes de implementar:

1. Ler `CLAUDE.md` na raiz do projeto (fonte operacional: stack, URLs, funções, convenções).
2. Ler todos os arquivos em `docs/ai-memory/` (fonte de negócio: regras, integridade, arquitetura).
3. Mapear arquivos afetados.
4. Mapear dependências.
5. Identificar riscos.
6. Identificar impactos financeiros.

---

## Plano Obrigatório

Antes de executar alterações, apresentar:

- Objetivo
- Arquivos envolvidos
- Impactos
- Riscos
- Estratégia

---

## Após Implementação

Validar:

- Build
- Tipagem
- Banco de dados
- Regras de negócio
- Integridade financeira

---

## Entrega

Sempre informar:

- Arquivos alterados
- Alterações realizadas
- Riscos encontrados
- Melhorias futuras
- Refatorações recomendadas

---

## Deploy

### Após editar `src/main.jsx` ou qualquer arquivo em `api/`:

```bash
vercel deploy --prod
```

Executar imediatamente após salvar. Não esperar o usuário pedir.

### Após editar `appscript.gs`:

```bash
open -a "TextEdit" /Users/alexborges/financeiroop/appscript.gs
```

Instruir o usuário: **Cmd+A → Cmd+C → colar no editor do Google Apps Script → publicar nova versão do Web App**.

NUNCA entregar só o trecho alterado — o GAS exige substituição do arquivo completo.

---

## Commits

- Sempre em português.
- Prefixo `feat:` / `fix:` / `refactor:`.
- Nunca commitar: `producao-849675-financeiroop.p12`, `twilio_2FA_recovery_code.txt`.
- Sempre verificar `git status` antes de commit.

---

## Cálculos Financeiros

Nunca alterar cálculos financeiros sem:

1. Identificar todos os pontos de uso.
2. Analisar impacto em histórico existente.
3. Apresentar plano de migração se necessário.
4. Validar cenários obrigatórios (ver `03-AI-FINANCIAL-CALCULATIONS.md`).

---

## Funções Utilitárias — Frontend (`src/main.jsx`)

Usar sempre que disponível — nunca reimplementar:

| Função | Descrição |
|---|---|
| `buscarCEP(cep)` | ViaCEP → BrasilAPI → AwesomeAPI. Retorna `{status, rua, setor, cidadeEstado, ibge, lat?, lng?}` |
| `buscarCNPJ(cnpj)` | Proxy `/api/cnpj`. Retorna `{status, razaoSocial, situacao, dataAbertura, porte}` |
| `buscarCoordenadas(rua, setor, cidadeEstado)` | Nominatim direto. Retorna `{status, lat, lng}` |
| `ajustarDiaUtil(dateStr, feriadosSet)` | Avança data para próximo dia útil (pula fim de semana + feriados) |
| `calcProxVenc(diaVenc)` | Próximo vencimento = mês seguinte ao dia preferido |
| `statusEfetivo(parcela)` | Status real pela data (não pelo valor gravado) |
| `fmtR(valor)` | Formata em R$ |
| `fmtDt(data)` | Formata data pt-BR |
| `hojeStr()` | Data de hoje YYYY-MM-DD |
| `apiDateStr(s)` | Converte input date → YYYY-MM-DD para o GAS |
| `titleCasePT(s)` | Title case respeitando preposições PT |
| `normTel(s)` | Normaliza telefone: remove não-dígitos, 10→11 dígitos |
| `fixEmail(s)` | Lowercase + corrige @gmail.com.br |

---

## Funções Utilitárias — Backend (`appscript.gs`, 2026-07-04)

Antes de implementar operação financeira reversível ou integração por webhook, usar sempre que disponível — nunca reimplementar:

| Função | Descrição |
|---|---|
| `registrarUndo(tipo, idContrato, idCliente, nomeCli, payload)` | Registra operação reversível — chamar ao final de toda operação financeira que precise de "desfazer" |
| `reverterOperacao(idUndo, motivo)` | Desfaz uma operação registrada (dentro do TTL de 15 min, sem operação mais recente pendente no contrato) |
| `_idem_check(chave)` / `_idem_reg(chave, tipo, meta)` | Proteção de idempotência — usar em todo novo webhook que grava dado financeiro |
| `gerarPropostaQuitacaoPix(dados)` | Gera proposta de quitação antecipada com desconto, TXID fixo por contrato, expira em 48h |
| `gerarCertificadoQuitacao(params)` / `buscarCertificadoPublico(codigo)` | Certificado público de quitação (dedup por contrato; CPF sempre mascarado na leitura pública) |
| `auditarIntegridadeSistema()` | Auditoria automática de integridade — não corrige nada, só diagnostica e loga em `AUDITORIA` |

Cada uma dessas funções tem seção própria em `docs/ai-memory/05-AI-ARCHITECTURE-RULES.md` (padrões de undo/idempotência) e em `CLAUDE.md` (uso prático).

---

## Hierarquia de Prioridade

1. Regras de negócio
2. Cálculos financeiros
3. Banco de dados
4. Código

Quando existir conflito entre implementação e documentação, a documentação deve prevalecer.
