# Rifa TULO

Site da rifa de um relógio mandala feito à mão. O dinheiro arrecadado vai para as obras e melhorias internas do terreiro.

O visitante escolhe os números, informa nome e telefone, recebe um comprovante de reserva com a chave Pix e envia o comprovante de pagamento pelo WhatsApp. As reservas ficam guardadas em uma planilha do Google, que todos os visitantes do site consultam.

## Arquivos

| Arquivo | O que é |
|---|---|
| [index.html](index.html) | O site inteiro: página, estilos e JavaScript, sem dependências externas |
| [apps-script.gs](apps-script.gs) | Código do Google Apps Script que fica dentro da planilha e serve de backend |
| `relogio mandala.jpeg` | Foto do prêmio |
| `TULO.webp` | Imagem de fundo |

## Funcionalidades

- **Grade com os números de 1 até `TOTAL_NUMBERS`**, cada um em uma cor conforme a situação:

  | Cor | Situação |
  |---|---|
  | Cinza escuro | Livre: pode ser selecionado |
  | Verde | Selecionado pelo visitante |
  | Cinza claro | Reservado, aguardando o Pix (pendente) |
  | Vermelho | Pago |

- **Reserva com comprovante:** depois de confirmar, o visitante vê o nome, o telefone, os números, o valor total e a data, além da chave Pix com um botão de copiar.
- **Envio pelo WhatsApp:** um botão abre o WhatsApp do organizador com uma mensagem pronta contendo o nome e os números.
- **Reservas compartilhadas:** um número reservado por um visitante aparece como pendente para todos os outros.
- **Proteção contra reserva dupla:** a planilha confere os números no momento de gravar. Se outra pessoa reservou o mesmo número segundos antes, o pedido é recusado e o site avisa o visitante.
- **Prazo de reserva:** uma reserva pendente vale por `HOLD_HOURS` horas. Depois disso, o número volta a ficar livre.
- **Atualização automática:** a grade consulta a planilha a cada `REFRESH_SECONDS` segundos, sem recarregar a página. A atualização pausa quando a aba do navegador está em segundo plano e durante o envio de uma reserva.
- **Números repetidos contam uma vez só:** isso vale para números repetidos na mesma linha, em linhas diferentes ou na planilha e também no código. Se um número está pago em uma linha e pendente em outra, vale o pago.

## Como funciona

```
Visitante ──► index.html ──GET──►  Apps Script ──► Planilha
                         ◄───────  { reservas, pagos }

          ──► Confirmar ──POST──►  Apps Script ──► confere conflitos ──► grava linha
                         ◄───────  { ok } ou { ok: false, conflitos }
```

### Site ([index.html](index.html))

1. Ao abrir, desenha a grade com o que já sabe: as listas do código e as reservas feitas neste navegador.
2. Chama `carregarReservas()`, que faz um GET na `SCRIPT_URL` e redesenha a grade com os pendentes e os pagos da planilha. Essa chamada se repete a cada `REFRESH_SECONDS` segundos.
3. Ao confirmar, `processarReserva()` envia `{ nome, telefone, numeros }` por POST:
   - se a planilha aceitar, o site mostra o comprovante e guarda os números no `localStorage` como pendentes;
   - se houver conflito, avisa o visitante, tira esses números da seleção e atualiza a grade;
   - se houver erro de conexão, avisa o visitante e não reserva nada.

O POST usa `Content-Type: text/plain`. Isso evita a checagem prévia de CORS, que o Apps Script não suporta, e ainda permite ler a resposta.

### Planilha ([apps-script.gs](apps-script.gs))

O script usa a **primeira aba** da planilha:

| A | B | C | D | E |
|---|---|---|---|---|
| Data/Hora | Nome | Telefone | Números | Status |

- **`doGet()`** devolve os números pagos e as reservas pendentes que ainda estão no prazo.
- **`doPost()`** grava uma nova linha com o status `Pendente Pix`. Antes, confere se algum número já está pago ou pendente. Usa `LockService` para que dois pedidos ao mesmo tempo não peguem o mesmo número.

Como cada status é tratado:

| Status (coluna E) | Efeito no site |
|---|---|
| `Pendente Pix` ou vazio | Cinza por `HORAS_RESERVA` horas a partir da Data/Hora |
| `Pago` | Vermelho permanentemente |
| `Cancelado` ou qualquer outro texto | Número livre |

Os números da coluna D são separados por vírgula, com ou sem espaço (`7, 8` ou `7,8`). A coluna é gravada como texto para o Sheets não transformar `1,2` em número decimal.

## Gerenciando a rifa

### Pela planilha (recomendado)

As mudanças aparecem no site em até `REFRESH_SECONDS` segundos.

| Para… | Faça |
|---|---|
| Confirmar um pagamento | Mude o Status da linha para `Pago` |
| Liberar um número | Mude o Status para `Cancelado` |
| Registrar uma venda feita fora do site | Crie uma linha com os números na coluna D e Status `Pago` |
| Reservar à mão | Crie uma linha com Data/Hora (`dd/mm/aaaa hh:mm:ss`), números e Status `Pendente Pix` |

### Pelo código ([index.html](index.html))

Estas listas continuam funcionando junto com a planilha. Cada mudança exige publicar o site de novo.

| Constante | Uso |
|---|---|
| `OCCUPIED_NUMBERS` | Números pagos (vermelhos) |
| `RESERVED_NUMBERS` | Reservas manuais, no formato `{ num: 5, time: "2026-10-09T10:00:00" }` |
| `CANCELED_NUMBERS` | Libera números à força, ignorando reservas pendentes |

## Configuração

Em [index.html](index.html):

| Constante | Descrição |
|---|---|
| `TOTAL_NUMBERS` | Quantidade de números da rifa |
| `PRICE_PER_NUM` | Valor de cada número, em R$ |
| `PHONE_NUMBER` | WhatsApp do organizador (55 + DDD + número) |
| `HOLD_HOURS` | Prazo da reserva, em horas |
| `REFRESH_SECONDS` | Intervalo da atualização automática. Evite menos de 30 por causa dos limites de execução do Apps Script |
| `SCRIPT_URL` | URL do app da web do Apps Script |

A chave Pix e os textos (título, data do sorteio, avisos) ficam no próprio HTML.

> **O prazo da reserva aparece em três lugares e eles precisam ser iguais:** `HOLD_HOURS` no [index.html](index.html), `HORAS_RESERVA` no [apps-script.gs](apps-script.gs) e os textos de aviso da página.

## Publicando alterações no Apps Script

1. Na planilha, abra **Extensões → Apps Script** e cole o conteúdo do [apps-script.gs](apps-script.gs).
2. Vá em **Implantar → Gerenciar implantações**, clique no lápis da implantação atual e escolha **Versão: Nova versão**.
   - Use "Executar como: **Eu**" e "Quem pode acessar: **Qualquer pessoa**".
   - Se usar **Nova implantação**, a URL muda e é preciso atualizar a `SCRIPT_URL` no [index.html](index.html).
3. Para testar, abra a `SCRIPT_URL` no navegador. Deve aparecer `{"ok":true,"reservas":[...],"pagos":[...]}`.
4. Só depois publique o [index.html](index.html), se ele também mudou.
