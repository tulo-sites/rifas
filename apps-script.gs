/**
 * Backend da Rifa TULO (Google Apps Script vinculado à planilha).
 *
 * Usa a primeira aba da planilha, com as colunas:
 *   A: Data/Hora | B: Nome | C: Telefone | D: Números | E: Status
 *
 * Status:
 *   "Pendente Pix" (ou vazio) -> bloqueia os números por HORAS_RESERVA horas
 *   "Cancelado"               -> libera os números imediatamente
 *   Qualquer outro valor (ex.: "Pago") é apenas anotação; números pagos
 *   continuam sendo marcados em OCCUPIED_NUMBERS no index.html.
 *
 * Publicação: Implantar > Gerenciar implantações > editar a implantação atual >
 * Versão: "Nova versão". Assim a URL (SCRIPT_URL do index.html) continua a mesma.
 * Executar como: "Eu"; Quem pode acessar: "Qualquer pessoa".
 */

const HORAS_RESERVA = 1; // Deve ser igual a HOLD_HOURS no index.html
const STATUS_PENDENTE = 'Pendente Pix';
const STATUS_CANCELADO = 'cancelado';

// GET: lista as reservas pendentes ativas para o site travar os números
function doGet() {
  return json_({ ok: true, reservas: reservasAtivas_() });
}

// POST: grava uma nova reserva, recusando números já reservados por outra pessoa
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); // Evita que dois pedidos simultâneos peguem o mesmo número
  try {
    const dados = JSON.parse(e.postData.contents);
    const nome = String(dados.nome || '').trim();
    const telefone = String(dados.telefone || '').trim();
    const numeros = (Array.isArray(dados.numeros) ? dados.numeros : String(dados.numeros || '').split(','))
      .map(n => Number(String(n).trim()))
      .filter(n => Number.isInteger(n) && n > 0);

    if (!nome || !telefone || numeros.length === 0) {
      return json_({ ok: false, erro: 'Dados incompletos.' });
    }

    const reservados = new Set(reservasAtivas_().map(r => r.num));
    const conflitos = numeros.filter(n => reservados.has(n));
    if (conflitos.length > 0) {
      return json_({ ok: false, conflitos: conflitos });
    }

    const aba = aba_();
    const linha = aba.getLastRow() + 1;
    aba.getRange(linha, 1, 1, 5)
      // Texto puro em B:E para o Sheets não converter "1, 2" em número decimal
      .setNumberFormats([['dd/mm/yyyy hh:mm:ss', '@', '@', '@', '@']])
      .setValues([[new Date(), nome, telefone, numeros.join(', '), STATUS_PENDENTE]]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function reservasAtivas_() {
  const aba = aba_();
  if (aba.getLastRow() < 1) return [];

  // Lê todas as linhas; um eventual cabeçalho é ignorado por não ter data válida
  const linhas = aba.getRange(1, 1, aba.getLastRow(), 5).getValues();
  const limite = Date.now() - HORAS_RESERVA * 60 * 60 * 1000;
  const reservas = [];

  linhas.forEach(([valorData, , , numeros, status]) => {
    const data = lerData_(valorData);
    if (!data) return;

    const st = String(status).trim();
    const pendente = st === '' || st.toLowerCase() === STATUS_PENDENTE.toLowerCase();
    if (!pendente) return; // Cancelado, Pago ou outra anotação
    if (data.getTime() < limite) return;

    String(numeros).split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isInteger(n) && n > 0)
      .forEach(num => reservas.push({ num: num, time: data.toISOString() }));
  });

  return reservas;
}

// Aceita tanto datas reais do Sheets quanto o texto "dd/MM/yyyy HH:mm:ss" (horário de Brasília)
// gravado pela versão anterior do script
function lerData_(valor) {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;

  const m = String(valor).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dia, mes, ano, hora, min, seg] = m.map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, hora + 3, min, seg)); // GMT-03:00 -> UTC
}

function aba_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
