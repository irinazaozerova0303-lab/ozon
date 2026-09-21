/* AI-агент Ozon — локальный инструмент анализа магазина.
   Всё выполняется в браузере: файлы не покидают устройство.
   Принцип: ничего не придумывать. Если показатель нельзя посчитать
   из загруженных данных — так и пишем: "Недостаточно данных". */
(function(){
'use strict';

/* ---------- 1. СЛОВАРЬ КОЛОНОК ---------- */

const FIELD_SYNONYMS = {
  sku: ['sku','артикул','артикул продавца','код товара','offer id','ozon id','номенклатура','артикул sku'],
  name: ['название','название товара','товар','наименование','наименование товара'],
  category: ['категория','категория товара'],
  cost: ['себестоимость','закупочная цена','закупочная стоимость','цена закупки','cost'],
  price: ['цена','текущая цена','цена продажи','цена товара','розничная цена'],
  minPrice: ['минимальная цена','мин цена','минимально допустимая цена','min price'],
  targetMargin: ['целевая маржинальность','целевая маржа','target margin'],
  targetDrr: ['целевой дрр','target drr'],
  stock: ['остаток','доступно','остаток на складе','остаток шт','available','текущий остаток','остатки'],
  avgSalesDay: ['средние продажи в день','продажи в день','среднедневные продажи','avg sales day'],
  revenue: ['выручка','сумма продаж','заказано на сумму','продажи руб','revenue','заказано на сумму руб'],
  orders: ['заказы','количество заказов','кол во заказов','orders','заказано шт','штук заказано'],
  buyouts: ['выкупы','выкуплено','количество выкупов','buyouts','выкуплено шт'],
  returns: ['возвраты','возвращено','количество возвратов','returns'],
  cancellations: ['отмены','отменено','количество отмен','cancellations'],
  adSpend: ['расход','расходы на рекламу','затраты на рекламу','расход руб','spend','рекламный расход'],
  impressions: ['показы','impressions'],
  clicks: ['клики','переходы','clicks'],
  cardViews: ['просмотры карточки','просмотры','переходы в карточку','card views'],
  cartAdds: ['добавлено в корзину','корзина','добавления в корзину','cart adds'],
  adOrders: ['заказы с рекламы','заказы по рекламе','ad orders'],
  adRevenue: ['рекламные продажи','продажи с рекламы','ad revenue'],
  campaign: ['кампания','название кампании','campaign','рекламная кампания'],
  cpc: ['cpc','цена за клик','ставка'],
  rating: ['рейтинг','rating'],
  reviewsCount: ['отзывы','количество отзывов','кол во отзывов','reviews'],
  date: ['дата','date','период','день'],
  leadTimeDays: ['срок поставки','срок поставки дни','lead time','дней в пути','срок доставки'],
  inTransit: ['в пути','товар в пути','in transit'],
  commission: ['комиссия','комиссия ozon','commission'],
  logistics: ['логистика','логистика ozon','стоимость логистики','logistics'],
  crossdock: ['кросс-докинг','кроссдокинг','cross docking','crossdock','cross-dock'],
  storage: ['хранение','стоимость хранения','storage'],
  otherExpenses: ['прочие расходы','другие расходы','other expenses'],
  profit: ['прибыль','profit'],
  beforeValue: ['показатель до','значение до'],
  afterValue: ['показатель после','значение после'],
  reason: ['причина'],
  expectedEffect: ['ожидаемый эффект'],
  actualEffect: ['фактический эффект'],
  conclusion: ['вывод'],
  target: ['sku или кампания','объект изменения'],
  changeDesc: ['изменение','что изменили'],
};

const FILE_TYPES = {
  sales:       { label:'Продажи / аналитика', requiresSku:true,  indicators:{revenue:3,orders:2,buyouts:1,cardViews:1,cartAdds:1,returns:1,cancellations:1} },
  stocks:      { label:'Остатки',              requiresSku:true,  indicators:{stock:3,inTransit:1,avgSalesDay:1,leadTimeDays:1} },
  advertising: { label:'Реклама',              requiresSku:false, indicators:{impressions:3,clicks:2,adSpend:3,campaign:2,adOrders:1,adRevenue:1,cpc:1} },
  finance:     { label:'Финансы',              requiresSku:false, indicators:{commission:3,logistics:2,crossdock:2,storage:2,otherExpenses:1,profit:2} },
  cost:        { label:'Себестоимость',        requiresSku:true,  indicators:{cost:3} },
  shipments:   { label:'Поставки',             requiresSku:false, indicators:{leadTimeDays:3,inTransit:3} },
  products:    { label:'Товары (справочник)',  requiresSku:true,  indicators:{category:3,name:1,minPrice:1,targetMargin:1,targetDrr:1,price:1} },
  reviews:     { label:'Отзывы',                requiresSku:true,  indicators:{rating:3,reviewsCount:2} },
  decisions:   { label:'История решений',      requiresSku:false, indicators:{beforeValue:3,afterValue:3,reason:1,expectedEffect:1,actualEffect:1,conclusion:1} },
};

const HELP_COLUMNS = [
  ['sales','Продажи / аналитика','SKU, Выручка / Заказано на сумму, Заказы, Выкупы, Возвраты, Отмены, Просмотры карточки, Добавления в корзину, Дата'],
  ['stocks','Остатки','SKU, Остаток, В пути, Средние продажи в день, Срок поставки'],
  ['advertising','Реклама','Кампания, SKU (опц.), Показы, Клики, Расход, Заказы с рекламы, Рекламные продажи, Дата'],
  ['finance','Финансы','SKU, Комиссия, Логистика, Кросс-докинг, Хранение, Прочие расходы, Прибыль'],
  ['cost','Себестоимость','SKU, Себестоимость'],
  ['shipments','Поставки','SKU, Срок поставки, В пути'],
  ['products','Товары (справочник)','SKU, Название, Категория, Цена, Минимальная цена, Целевая маржинальность, Целевой ДРР'],
  ['reviews','Отзывы','SKU, Рейтинг, Количество отзывов'],
  ['decisions','История решений','Дата, SKU или кампания, Показатель до, Изменение, Показатель после, Причина, Ожидаемый эффект, Фактический эффект, Вывод'],
];

const DEFAULT_THRESHOLDS = {
  lowStockDaysDefault: 7,
  overstockDaysDefault: 60,
  declineWarnPct: 20,
  declineBadPct: 40,
  growthPct: 15,
  drrDegradePp: 5,
  targetMarginDefault: 20,
  safetyDays: 5,
};

/* ---------- 2. УТИЛИТЫ ---------- */

function normalize(s){
  return String(s==null?'':s)
    .toLowerCase()
    .replace(/ё/g,'е')
    .replace(/[.,%()№#:;\/\\_\-–—]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function parseNumber(v){
  if(v==null || v==='') return null;
  if(typeof v==='number') return isFinite(v)?v:null;
  let s = String(v).trim().replace(/[ \s]/g,'').replace(/[₽%]/g,'');
  if(s==='') return null;
  if(s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  else s = s.replace(/,/g,'');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function fmtMoney(n){
  if(n==null) return 'Недостаточно данных';
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}
function fmtNum(n, d){
  if(n==null) return 'Недостаточно данных';
  return n.toLocaleString('ru-RU', {maximumFractionDigits: d==null?1:d});
}
function fmtPct(n){
  if(n==null) return 'Недостаточно данных';
  return n.toFixed(1).replace('.', ',') + '%';
}
function todayStr(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}
function uid(){
  return 'id' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
}
function sum(arr){
  const vals = arr.filter(v=>v!=null);
  if(!vals.length) return null;
  return vals.reduce((a,b)=>a+b,0);
}

/* ---------- 3. РАСПОЗНАВАНИЕ КОЛОНОК ---------- */

function matchHeaderToField(header){
  const h = normalize(header);
  if(!h) return null;
  let best = null, bestScore = 0;
  for(const field in FIELD_SYNONYMS){
    for(const syn of FIELD_SYNONYMS[field]){
      const s = normalize(syn);
      if(!s) continue;
      let score = 0;
      if(h === s) score = 2;
      else if(h.includes(s)) score = 1;
      if(score > bestScore){ bestScore = score; best = field; }
    }
  }
  return best;
}

function findHeaderRow(aoa){
  let bestIdx = 0, bestCount = -1;
  const limit = Math.min(aoa.length, 10);
  for(let i=0;i<limit;i++){
    const row = aoa[i] || [];
    let count = 0;
    row.forEach(cell=>{ if(matchHeaderToField(cell)) count++; });
    if(count > bestCount){ bestCount = count; bestIdx = i; }
  }
  return bestIdx;
}

function sheetToCanonicalRows(sheet){
  const aoa = XLSX.utils.sheet_to_json(sheet, {header:1, defval:null, raw:true});
  if(!aoa.length) return {canonicalRows:[], colMap:{}, headerRow:[]};
  const headerIdx = findHeaderRow(aoa);
  const headerRow = (aoa[headerIdx]||[]).map(h=> h==null ? '' : String(h));
  const colMap = {}; // index -> field
  headerRow.forEach((h,i)=>{ const f = matchHeaderToField(h); if(f && !(f in colMapReverse(colMap))) colMap[i]=f; });

  const dataRows = aoa.slice(headerIdx+1).filter(r=>r && r.some(c=>c!=null && String(c).trim()!==''));
  const canonicalRows = dataRows.map(r=>{
    const o = {};
    for(const idx in colMap){
      const field = colMap[idx];
      if(o[field]==null) o[field] = r[idx];
    }
    return o;
  });
  return {canonicalRows, colMap, headerRow};
}
function colMapReverse(colMap){
  const rev = {};
  for(const k in colMap) rev[colMap[k]] = true;
  return rev;
}

function detectFileType(canonicalRows){
  const presence = {};
  const n = canonicalRows.length || 1;
  canonicalRows.forEach(row=>{
    for(const f in row){
      if(row[f]!=null && String(row[f]).trim()!=='') presence[f] = (presence[f]||0)+1;
    }
  });
  const hasSku = (presence.sku||0) > 0;
  let best = null, bestScore = -Infinity;
  for(const type in FILE_TYPES){
    const def = FILE_TYPES[type];
    if(def.requiresSku && !hasSku) continue;
    let score = 0;
    for(const f in def.indicators){
      const weight = presence[f] ? (presence[f]/n) : 0;
      score += def.indicators[f] * weight;
    }
    if(score > bestScore){ bestScore = score; best = type; }
  }
  if(bestScore <= 0.2) best = null;
  const recognizedFields = Object.keys(presence);
  return {type: best, score: bestScore, recognizedFields, hasSku};
}

function readFileAsWorkbook(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const wb = XLSX.read(e.target.result, {type:'array', cellDates:false});
        resolve(wb);
      }catch(err){ reject(err); }
    };
    reader.onerror = ()=> reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function bestSheet(wb){
  let best=null, bestLen=-1;
  wb.SheetNames.forEach(name=>{
    const sheet = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(sheet,{header:1,defval:null});
    if(aoa.length > bestLen){ bestLen = aoa.length; best = {name, sheet}; }
  });
  return best;
}

/* ---------- 4. СОСТОЯНИЕ ЗАГРУЗКИ ---------- */

const queued = { current: [], previous: [] };

async function addFiles(period, fileList){
  for(const file of Array.from(fileList)){
    try{
      const wb = await readFileAsWorkbook(file);
      const {name, sheet} = bestSheet(wb);
      const {canonicalRows, headerRow} = sheetToCanonicalRows(sheet);
      const detection = detectFileType(canonicalRows);
      queued[period].push({
        id: uid(), file, fileName: file.name, sheetName: name,
        canonicalRows, headerRow, detection,
        chosenType: detection.type || 'unknown',
      });
      log(`✅ ${file.name} — распознано как «${detection.type ? FILE_TYPES[detection.type].label : 'не определено'}», строк: ${canonicalRows.length}, полей найдено: ${detection.recognizedFields.length}.`);
    }catch(err){
      log(`❌ ${file.name}: не удалось прочитать файл (${err.message}).`, true);
    }
  }
  renderFileLists();
}

function pushApiEntry(period, label, type, canonicalRows, periodDaysHint, warnings){
  const detection = { type, score:1, recognizedFields: Array.from(new Set(canonicalRows.flatMap(r=>Object.keys(r)))), hasSku:true };
  queued[period] = queued[period].filter(i=> !(i.fromApi && i.apiType===type));
  queued[period].push({
    id: uid(), fileName: label, sheetName:'Ozon API', canonicalRows, headerRow: [],
    detection, chosenType: type, fromApi:true, apiType: type, periodDaysHint,
  });
  renderFileLists();
  log(`✅ ${label} — получено из Ozon API, строк: ${canonicalRows.length}.`);
  (warnings||[]).forEach(w=> log('⚠️ ' + w, true));
}

function log(msg, isErr){
  const el = document.getElementById('upload-log');
  const line = document.createElement('div');
  line.className = isErr ? 'log-err' : 'log-ok';
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function renderFileLists(){
  ['current','previous'].forEach(period=>{
    const wrap = document.getElementById('list-'+period);
    wrap.innerHTML = '';
    queued[period].forEach(item=>{
      const row = document.createElement('div');
      row.className = 'file-row';
      const fieldsStr = item.detection.recognizedFields.map(f=> f in FIELD_LABELS ? FIELD_LABELS[f] : f).join(', ') || '—';
      row.innerHTML = `
        <div class="fr-top">
          <span class="fr-name">${escapeHtml(item.fileName)}</span>
          <button class="fr-remove" data-remove="${item.id}" data-period="${period}">убрать</button>
        </div>
        <div class="fr-fields">
          Тип:
          <select data-type="${item.id}" data-period="${period}">
            <option value="unknown" ${item.chosenType==='unknown'?'selected':''}>— выбрать вручную —</option>
            ${Object.keys(FILE_TYPES).map(t=>`<option value="${t}" ${item.chosenType===t?'selected':''}>${FILE_TYPES[t].label}</option>`).join('')}
          </select>
          <div style="margin-top:6px;">Строк: ${item.canonicalRows.length}. Распознаны поля: ${escapeHtml(fieldsStr)}.</div>
        </div>`;
      wrap.appendChild(row);
    });
  });
  wireFileListEvents();
}

const FIELD_LABELS = {
  sku:'SKU', name:'Название', category:'Категория', cost:'Себестоимость', price:'Цена',
  minPrice:'Мин.цена', targetMargin:'Цел.маржа', targetDrr:'Цел.ДРР', stock:'Остаток',
  avgSalesDay:'Продажи/день', revenue:'Выручка', orders:'Заказы', buyouts:'Выкупы',
  returns:'Возвраты', cancellations:'Отмены', adSpend:'Рекл.расход', impressions:'Показы',
  clicks:'Клики', cardViews:'Просмотры карточки', cartAdds:'Корзина', adOrders:'Заказы с рекламы',
  adRevenue:'Рекл.продажи', campaign:'Кампания', cpc:'CPC', rating:'Рейтинг',
  reviewsCount:'Кол-во отзывов', date:'Дата', leadTimeDays:'Срок поставки', inTransit:'В пути',
  commission:'Комиссия', logistics:'Логистика', crossdock:'Кросс-докинг', storage:'Хранение', otherExpenses:'Проч.расходы',
  profit:'Прибыль', beforeValue:'До', afterValue:'После', reason:'Причина',
  expectedEffect:'Ожид.эффект', actualEffect:'Факт.эффект', conclusion:'Вывод',
};

function wireFileListEvents(){
  document.querySelectorAll('[data-remove]').forEach(btn=>{
    btn.onclick = ()=>{
      const period = btn.dataset.period, id = btn.dataset.remove;
      queued[period] = queued[period].filter(i=>i.id!==id);
      renderFileLists();
    };
  });
  document.querySelectorAll('[data-type]').forEach(sel=>{
    sel.onchange = ()=>{
      const period = sel.dataset.period, id = sel.dataset.type;
      const item = queued[period].find(i=>i.id===id);
      if(item) item.chosenType = sel.value;
    };
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- 5. ОБЪЕДИНЕНИЕ ПО SKU ---------- */

function newDataset(){
  return { skuMap:{}, campaigns:{}, importedDecisions:[], distinctDates:new Set() };
}

function getOrCreateSku(ds, sku){
  if(!ds.skuMap[sku]) ds.skuMap[sku] = { sku };
  return ds.skuMap[sku];
}

function addTo(rec, field, val){
  if(val==null) return;
  rec[field] = (rec[field]||0) + val;
}
function setIfEmpty(rec, field, val){
  if(val==null) return;
  if(rec[field]==null) rec[field] = val;
}
function setLatest(rec, field, val){
  if(val==null) return;
  rec[field] = val;
}

function mergeFile(ds, type, rows){
  rows.forEach(row=>{
    const sku = row.sku!=null ? String(row.sku).trim() : null;
    const revenue = parseNumber(row.revenue);
    const orders = parseNumber(row.orders);
    const buyouts = parseNumber(row.buyouts);
    const returns = parseNumber(row.returns);
    const cancellations = parseNumber(row.cancellations);
    const cardViews = parseNumber(row.cardViews);
    const cartAdds = parseNumber(row.cartAdds);
    const stock = parseNumber(row.stock);
    const inTransit = parseNumber(row.inTransit);
    const avgSalesDay = parseNumber(row.avgSalesDay);
    const leadTimeDays = parseNumber(row.leadTimeDays);
    const cost = parseNumber(row.cost);
    const price = parseNumber(row.price);
    const minPrice = parseNumber(row.minPrice);
    const targetMargin = parseNumber(row.targetMargin);
    const targetDrr = parseNumber(row.targetDrr);
    const commission = parseNumber(row.commission);
    const logistics = parseNumber(row.logistics);
    const crossdock = parseNumber(row.crossdock);
    const storage = parseNumber(row.storage);
    const otherExpenses = parseNumber(row.otherExpenses);
    const profitDirect = parseNumber(row.profit);
    const rating = parseNumber(row.rating);
    const reviewsCount = parseNumber(row.reviewsCount);
    const adSpend = parseNumber(row.adSpend);
    const impressions = parseNumber(row.impressions);
    const clicks = parseNumber(row.clicks);
    const adOrders = parseNumber(row.adOrders);
    const adRevenue = parseNumber(row.adRevenue);
    const cpc = parseNumber(row.cpc);
    if(row.date) ds.distinctDates.add(String(row.date));

    if(type==='sales'){
      if(!sku) return;
      const rec = getOrCreateSku(ds, sku);
      setIfEmpty(rec,'name',row.name); setIfEmpty(rec,'category',row.category);
      addTo(rec,'revenue',revenue); addTo(rec,'orders',orders); addTo(rec,'buyouts',buyouts);
      addTo(rec,'returns',returns); addTo(rec,'cancellations',cancellations);
      addTo(rec,'cardViews',cardViews); addTo(rec,'cartAdds',cartAdds);
    } else if(type==='stocks'){
      if(!sku) return;
      const rec = getOrCreateSku(ds, sku);
      setIfEmpty(rec,'name',row.name);
      addTo(rec,'stock',stock); addTo(rec,'inTransit',inTransit);
      setLatest(rec,'avgSalesDayFromFile',avgSalesDay);
      setLatest(rec,'leadTimeDays',leadTimeDays);
    } else if(type==='cost'){
      if(!sku) return;
      const rec = getOrCreateSku(ds, sku);
      setLatest(rec,'cost',cost);
    } else if(type==='products'){
      if(!sku) return;
      const rec = getOrCreateSku(ds, sku);
      setLatest(rec,'name',row.name); setLatest(rec,'category',row.category);
      setLatest(rec,'price',price); setLatest(rec,'minPrice',minPrice);
      setLatest(rec,'targetMargin',targetMargin); setLatest(rec,'targetDrr',targetDrr);
    } else if(type==='reviews'){
      if(!sku) return;
      const rec = getOrCreateSku(ds, sku);
      setLatest(rec,'rating',rating);
      addTo(rec,'reviewsCount',reviewsCount);
    } else if(type==='shipments'){
      if(sku){
        const rec = getOrCreateSku(ds, sku);
        setLatest(rec,'leadTimeDays',leadTimeDays);
        addTo(rec,'inTransit',inTransit);
      }
    } else if(type==='finance'){
      if(sku){
        const rec = getOrCreateSku(ds, sku);
        addTo(rec,'commission',commission); addTo(rec,'logistics',logistics);
        addTo(rec,'crossdock',crossdock);
        addTo(rec,'storage',storage); addTo(rec,'otherExpenses',otherExpenses);
        addTo(rec,'profitDirect',profitDirect);
      }
    } else if(type==='advertising'){
      const campName = row.campaign ? String(row.campaign).trim() : (sku ? `SKU ${sku}` : 'Без названия');
      if(!ds.campaigns[campName]) ds.campaigns[campName] = {campaign:campName, sku: sku||null};
      const c = ds.campaigns[campName];
      addTo(c,'adSpend',adSpend); addTo(c,'impressions',impressions); addTo(c,'clicks',clicks);
      addTo(c,'adOrders',adOrders); addTo(c,'adRevenue',adRevenue);
      if(cpc!=null) setLatest(c,'cpc',cpc);
      if(sku){
        const rec = getOrCreateSku(ds, sku);
        addTo(rec,'adSpend',adSpend); addTo(rec,'impressions',impressions); addTo(rec,'clicks',clicks);
        addTo(rec,'adOrders',adOrders); addTo(rec,'adRevenue',adRevenue);
      }
    } else if(type==='decisions'){
      ds.importedDecisions.push({
        id: uid(), date: row.date||'', target: row.target||row.sku||row.campaign||'',
        metric: row.changeDesc||'', before: row.beforeValue, change: row.changeDesc||'',
        after: row.afterValue, reason: row.reason||'', expectedEffect: row.expectedEffect||'',
        actualEffect: row.actualEffect||'', conclusion: row.conclusion||'', source:'imported',
      });
    }
  });
}

function buildDataset(period){
  const ds = newDataset();
  queued[period].forEach(item=>{
    if(item.chosenType && item.chosenType!=='unknown'){
      mergeFile(ds, item.chosenType, item.canonicalRows);
      if(item.periodDaysHint) ds.periodDaysHint = Math.max(ds.periodDaysHint||0, item.periodDaysHint);
    }
  });
  return ds;
}

/* ---------- 6. РАСЧЁТ ПРОИЗВОДНЫХ ПОКАЗАТЕЛЕЙ ---------- */

function computeDerived(ds){
  const periodDays = Math.max(ds.distinctDates.size||0, ds.periodDaysHint||0) || null;
  const skus = Object.values(ds.skuMap);
  skus.forEach(rec=>{
    rec.assumptions = [];
    // avg sales/day
    if(rec.avgSalesDayFromFile!=null){
      rec.avgSalesDay = rec.avgSalesDayFromFile;
    } else if(rec.orders!=null && periodDays){
      rec.avgSalesDay = rec.orders / periodDays;
      rec.assumptions.push(`продажи/день = заказы ÷ ${periodDays} дн. периода`);
    } else {
      rec.avgSalesDay = null;
    }
    // days of stock
    rec.daysOfStock = (rec.stock!=null && rec.avgSalesDay>0) ? rec.stock/rec.avgSalesDay : null;

    // margin / profit
    const unitsSold = rec.buyouts!=null ? rec.buyouts : rec.orders;
    if(rec.profitDirect!=null){
      rec.profit = rec.profitDirect;
      rec.profitComplete = true;
    } else if(rec.revenue!=null && rec.cost!=null && unitsSold!=null){
      const cogs = rec.cost * unitsSold;
      rec.cogs = cogs;
      const missing = [];
      let deduction = cogs;
      ['commission','logistics','crossdock','storage','adSpend','otherExpenses'].forEach(f=>{
        if(rec[f]!=null) deduction += rec[f]; else missing.push(FIELD_LABELS[f]||f);
      });
      rec.profit = rec.revenue - deduction;
      rec.profitComplete = missing.length===0;
      if(missing.length) rec.assumptions.push(`прибыль приблизительная, не учтено: ${missing.join(', ')}`);
    } else {
      rec.profit = null;
    }
    rec.marginPct = (rec.profit!=null && rec.revenue) ? (rec.profit/rec.revenue*100) : null;

    // drr
    rec.drrPct = (rec.adSpend!=null && rec.adRevenue) ? (rec.adSpend/rec.adRevenue*100) : null;
    // ctr
    rec.ctrPct = (rec.clicks!=null && rec.impressions) ? (rec.clicks/rec.impressions*100) : null;
    // conversion
    if(rec.orders!=null && rec.clicks){ rec.convPct = rec.orders/rec.clicks*100; }
    else if(rec.orders!=null && rec.cardViews){ rec.convPct = rec.orders/rec.cardViews*100; rec.assumptions.push('конверсия считается от просмотров карточки, не от кликов'); }
    else rec.convPct = null;
  });

  const campaigns = Object.values(ds.campaigns);
  campaigns.forEach(c=>{
    c.ctrPct = (c.clicks!=null && c.impressions) ? (c.clicks/c.impressions*100) : null;
    c.drrPct = (c.adSpend!=null && c.adRevenue) ? (c.adSpend/c.adRevenue*100) : null;
    c.cpcCalc = (c.adSpend!=null && c.clicks) ? (c.adSpend/c.clicks) : (c.cpc!=null?c.cpc:null);
  });

  ds.periodDays = periodDays;
  ds.totals = {
    revenue: sum(skus.map(s=>s.revenue)),
    profit: sum(skus.filter(s=>s.profit!=null).map(s=>s.profit)),
    profitComplete: skus.length>0 && skus.every(s=>s.profit==null || s.profitComplete),
    orders: sum(skus.map(s=>s.orders)),
    adSpend: sum(skus.map(s=>s.adSpend)) ?? sum(campaigns.map(c=>c.adSpend)),
    adRevenue: sum(campaigns.map(c=>c.adRevenue)),
  };
  ds.totals.marginPct = (ds.totals.profit!=null && ds.totals.revenue) ? ds.totals.profit/ds.totals.revenue*100 : null;
  ds.totals.drrPct = (ds.totals.adSpend!=null && ds.totals.adRevenue) ? ds.totals.adSpend/ds.totals.adRevenue*100 : null;
  return ds;
}

function attachComparison(current, previous){
  if(!previous) return;
  Object.values(current.skuMap).forEach(rec=>{
    const prev = previous.skuMap[rec.sku];
    if(!prev) return;
    rec.prev = prev;
    rec.revenueGrowthPct = (prev.revenue) ? (rec.revenue - prev.revenue)/prev.revenue*100 : null;
    rec.drrDeltaPp = (rec.drrPct!=null && prev.drrPct!=null) ? rec.drrPct - prev.drrPct : null;
  });
  Object.values(current.campaigns).forEach(c=>{
    const prev = previous.campaigns[c.campaign];
    if(!prev) return;
    c.prev = prev;
    c.drrDeltaPp = (c.drrPct!=null && prev.drrPct!=null) ? c.drrPct - prev.drrPct : null;
    c.ordersDeltaPct = (prev.adOrders) ? (c.adOrders - prev.adOrders)/prev.adOrders*100 : null;
  });
  current.totals.revenueGrowthPct = (previous.totals.revenue) ? (current.totals.revenue-previous.totals.revenue)/previous.totals.revenue*100 : null;
}

/* ---------- 7. КЛАССИФИКАЦИЯ SKU ---------- */

function classifySku(rec, th){
  const notes = [];
  const targetMargin = rec.targetMargin!=null ? rec.targetMargin : th.targetMarginDefault;
  if(rec.targetMargin==null) notes.push(`целевая маржа не задана, использован порог по умолчанию ${th.targetMarginDefault}%`);

  let perf = 'unknown';
  if(rec.marginPct!=null && rec.marginPct < 0){
    perf = 'outsider'; notes.push('отрицательная маржинальность (факт)');
  } else if(rec.revenueGrowthPct!=null){
    if(rec.revenueGrowthPct <= -th.declineBadPct){
      perf = 'outsider'; notes.push(`выручка упала на ${fmtPct(Math.abs(rec.revenueGrowthPct))} к прошлому периоду`);
    } else if(rec.revenueGrowthPct <= -th.declineWarnPct){
      perf = 'problem'; notes.push(`выручка упала на ${fmtPct(Math.abs(rec.revenueGrowthPct))} к прошлому периоду`);
    } else if(rec.revenueGrowthPct >= th.growthPct){
      perf = 'growing'; notes.push(`выручка выросла на ${fmtPct(rec.revenueGrowthPct)} к прошлому периоду`);
    } else {
      perf = (rec.marginPct!=null && rec.marginPct >= targetMargin) ? 'leader_candidate' : 'stable';
    }
  } else if(rec.marginPct!=null){
    if(rec.marginPct >= targetMargin) perf = 'leader_candidate';
    else if(rec.marginPct < targetMargin*0.5){ perf = 'problem'; notes.push(`маржа ${fmtPct(rec.marginPct)} заметно ниже целевой ${fmtPct(targetMargin)}`); }
    else perf = 'stable';
  } else {
    perf = 'stable'; notes.push('недостаточно данных для точной классификации по прибыли/динамике');
  }
  rec.perfClass = perf;
  rec.perfNotes = notes;

  // stock badge
  const stockNotes = [];
  let stockBadge = 'na';
  if(rec.daysOfStock==null){
    stockBadge = 'na';
  } else if(rec.leadTimeDays!=null){
    stockBadge = rec.daysOfStock < rec.leadTimeDays ? 'deficit' : (rec.daysOfStock > th.overstockDaysDefault ? 'overstock' : 'ok');
    if(stockBadge==='deficit') stockNotes.push(`запас на ${fmtNum(rec.daysOfStock,1)} дн., срок следующей поставки ${fmtNum(rec.leadTimeDays,0)} дн.`);
  } else {
    if(rec.daysOfStock < th.lowStockDaysDefault){
      stockBadge='deficit'; stockNotes.push(`срок поставки не указан, применён порог по умолчанию ${th.lowStockDaysDefault} дн.`);
    } else if(rec.daysOfStock > th.overstockDaysDefault){
      stockBadge='overstock';
    } else stockBadge='ok';
  }
  rec.stockBadge = stockBadge;
  rec.stockNotes = stockNotes;
  return rec;
}

const PERF_LABELS = {
  leader_candidate: {label:'🟢 Лидер', cls:'badge-leader'},
  growing: {label:'🟢 Растущий', cls:'badge-growing'},
  stable: {label:'⚪ Стабильный', cls:'badge-stable'},
  problem: {label:'🟡 Проблемный', cls:'badge-problem'},
  outsider: {label:'🔴 Аутсайдер', cls:'badge-outsider'},
  unknown: {label:'⚪ Нет данных', cls:'badge-na'},
};
const STOCK_LABELS = {
  deficit: {label:'🔴 Риск дефицита', cls:'badge-deficit'},
  overstock: {label:'🟡 Избыток', cls:'badge-overstock'},
  ok: {label:'⚪ Норма', cls:'badge-stable'},
  na: {label:'Недостаточно данных', cls:'badge-na'},
};

/* ---------- 8. РЕКОМЕНДАЦИИ ПО РЕКЛАМЕ ---------- */

function buildAdRecommendations(campaigns, th){
  const recos = [];
  campaigns.forEach(c=>{
    if(c.adSpend>0 && !c.adOrders){
      recos.push({
        level:'critical', requiresConfirmation:true, impact: c.adSpend,
        title: `Кампания «${c.campaign}» — расход без заказов`,
        body: [
          `Сейчас: потрачено ${fmtMoney(c.adSpend)}, заказов с рекламы — 0.`,
          `Предлагаю: приостановить кампанию или снизить бюджет/ставку.`,
          `Почему: бюджет расходуется без результата.`,
          `Ожидаемый эффект: экономия ~${fmtMoney(c.adSpend)} за аналогичный период без потери продаж.`,
          `Риск: если заказы приходят с задержкой атрибуции, возможна недооценка эффекта кампании.`,
        ],
        confirmText:`Остановить/снизить бюджет кампании «${c.campaign}»`,
      });
    } else if(c.drrDeltaPp!=null && c.drrDeltaPp >= th.drrDegradePp){
      recos.push({
        level:'important', requiresConfirmation:true, impact: c.adSpend||0,
        title: `Кампания «${c.campaign}» — рост ДРР`,
        body: [
          `Сейчас: ДРР вырос с ${fmtPct(c.prev.drrPct)} до ${fmtPct(c.drrPct)}.`,
          `Предлагаю: снизить ставку/бюджет кампании.`,
          `Почему: эффективность рекламы ухудшилась относительно предыдущего периода.`,
          `Ожидаемый эффект: снижение рекламных расходов при сохранении необходимого объёма продаж.`,
          `Риск: возможное снижение рекламного трафика и заказов.`,
        ],
        confirmText:`Снизить бюджет/ставку кампании «${c.campaign}»`,
      });
    } else if(c.drrPct!=null && c.ordersDeltaPct!=null && c.ordersDeltaPct>=th.growthPct){
      recos.push({
        level:'growth', requiresConfirmation:true, impact: c.adRevenue||0,
        title: `Кампания «${c.campaign}» — кандидат на масштабирование`,
        body: [
          `Сейчас: ДРР ${fmtPct(c.drrPct)}, заказы выросли на ${fmtPct(c.ordersDeltaPct)}.`,
          `Предлагаю: увеличить бюджет кампании.`,
          `Почему: кампания даёт заказы при приемлемом ДРР и показывает рост.`,
          `Ожидаемый эффект: рост продаж пропорционально увеличению бюджета.`,
          `Риск: при масштабировании ДРР может ухудшиться, нужен контроль после изменения.`,
        ],
        confirmText:`Увеличить бюджет кампании «${c.campaign}»`,
      });
    }
  });
  recos.sort((a,b)=> (b.impact||0)-(a.impact||0));
  return recos;
}

/* ---------- 9. ПРИОРИТЕТЫ / ДЕЙСТВИЯ ---------- */

function buildPriorities(ds, adRecos){
  const items = [];
  Object.values(ds.skuMap).forEach(rec=>{
    if(rec.stockBadge==='deficit'){
      const lostRevenuePerDay = (rec.avgSalesDay!=null && rec.price!=null) ? rec.avgSalesDay*rec.price : null;
      items.push({
        level:'critical', requiresConfirmation:true,
        impact: lostRevenuePerDay!=null ? lostRevenuePerDay*7 : (rec.revenue||1),
        title:`${rec.sku} (${rec.name||'без названия'}) — риск дефицита`,
        body:[
          `Сейчас: запас ${fmtNum(rec.daysOfStock,1)} дн.${rec.leadTimeDays!=null?`, срок поставки ${fmtNum(rec.leadTimeDays,0)} дн.`:''}`,
          `Предлагаю: срочно заказать поставку.`,
          `Почему: товар может закончиться раньше следующей поставки.`,
          `Ожидаемый эффект: сохранение продаж и позиции карточки.`,
          `Риск: при неверной оценке спроса возможен избыточный заказ.`,
          rec.stockNotes.length?`Допущение: ${rec.stockNotes.join('; ')}`:'',
        ].filter(Boolean),
        confirmText:`Создать срочную поставку по SKU ${rec.sku}`,
      });
    }
    if(rec.stockBadge==='overstock'){
      items.push({
        level:'important', requiresConfirmation:false,
        impact:(rec.stock||0)*(rec.cost||0),
        title:`${rec.sku} (${rec.name||'без названия'}) — избыточный запас`,
        body:[
          `Сейчас: запас на ${fmtNum(rec.daysOfStock,1)} дн. продаж (порог избытка — ${DEFAULT_THRESHOLDS.overstockDaysDefault} дн.).`,
          `Предлагаю: рассмотреть промо/снижение поставок, чтобы не замораживать деньги в товаре.`,
          `Почему: запас существенно превышает скорость продаж.`,
          `Ожидаемый эффект: высвобождение оборотных средств.`,
          `Риск: агрессивное промо может снизить маржинальность.`,
        ],
        confirmText:`Запустить акцию/снизить поставки по SKU ${rec.sku}`,
      });
    }
    if(rec.perfClass==='outsider'){
      items.push({
        level:'critical', requiresConfirmation:false,
        impact: Math.abs(rec.profit!=null? rec.profit : (rec.revenue||0)),
        title:`${rec.sku} (${rec.name||'без названия'}) — аутсайдер`,
        body:[
          `Сейчас: ${rec.perfNotes.join('; ')||'показатели существенно хуже нормы'}.`,
          `Предлагаю: разобрать экономику товара (цена/себестоимость/реклама) и решить — чинить или выводить из ассортимента.`,
          `Почему: товар системно ухудшает прибыль магазина.`,
          `Ожидаемый эффект: остановка потерь прибыли.`,
          `Риск: вывод из ассортимента без анализа причины может быть преждевременным.`,
        ],
        confirmText:`Пересмотреть цену/ассортимент по SKU ${rec.sku}`,
      });
    } else if(rec.perfClass==='problem'){
      items.push({
        level:'important', requiresConfirmation:false,
        impact: Math.abs(rec.revenue||0)*0.2,
        title:`${rec.sku} (${rec.name||'без названия'}) — проблемный`,
        body:[
          `Сейчас: ${rec.perfNotes.join('; ')||'ухудшение ключевых показателей'}.`,
          `Предлагаю: проверить карточку, остатки, рекламу и цену по этому SKU.`,
          `Почему: показатели ухудшились, но пока не критично.`,
          `Ожидаемый эффект: предотвращение перехода в категорию «аутсайдер».`,
          `Риск: без точечного анализа причина может быть определена неверно (гипотеза, не факт).`,
        ],
        confirmText:null,
      });
    } else if(rec.perfClass==='growing' || rec.perfClass==='leader_candidate'){
      items.push({
        level:'growth', requiresConfirmation:false,
        impact: rec.revenue||0,
        title:`${rec.sku} (${rec.name||'без названия'}) — точка роста`,
        body:[
          `Сейчас: ${rec.perfNotes.join('; ')||'хорошие показатели'}.`,
          `Предлагаю: рассмотреть усиление продвижения / расширение поставки под этот SKU.`,
          `Почему: товар положительно влияет на прибыль магазина.`,
          `Ожидаемый эффект: рост выручки и прибыли при сохранении маржинальности.`,
          `Риск: рост продаж быстрее пополнения остатков может привести к дефициту — держите остатки под контролем.`,
        ],
        confirmText: null,
      });
    }
  });

  adRecos.forEach(r=> items.push(r));
  items.sort((a,b)=> (b.impact||0)-(a.impact||0));
  return items;
}

/* ---------- 10. ОТЧЁТ ---------- */

function buildReportText(ds, priorities, dateStr){
  const t = ds.totals;
  const lines = [];
  lines.push('📊 ЕЖЕДНЕВНЫЙ ОТЧЁТ OZON');
  lines.push(`Дата: ${dateStr}`);
  lines.push('');
  lines.push('ОСНОВНЫЕ ПОКАЗАТЕЛИ');
  lines.push(`Выручка: ${fmtMoney(t.revenue)}`);
  lines.push(`Прибыль: ${t.profit!=null ? fmtMoney(t.profit) + (t.profitComplete?'':' (приблизительно, не все статьи расходов учтены)') : 'Недостаточно данных'}`);
  lines.push(`Маржинальность: ${fmtPct(t.marginPct)}`);
  lines.push(`Заказы: ${t.orders!=null ? fmtNum(t.orders,0) : 'Недостаточно данных'}`);
  lines.push(`Рекламные расходы: ${fmtMoney(t.adSpend)}`);
  lines.push(`ДРР: ${fmtPct(t.drrPct)}`);
  lines.push('');

  const byLevel = level => priorities.filter(p=>p.level===level);
  const section = (title, level, max)=>{
    lines.push(title);
    const arr = byLevel(level).slice(0, max||5);
    if(!arr.length) lines.push('Нет.');
    else arr.forEach((p,i)=> lines.push(`${i+1}. ${p.title}`));
    lines.push('');
  };
  section('🔴 КРИТИЧНО', 'critical');
  section('🟡 ВАЖНО', 'important');
  section('🟢 ВОЗМОЖНОСТИ РОСТА', 'growth');

  lines.push('📦 ОСТАТКИ');
  const deficit = Object.values(ds.skuMap).filter(s=>s.stockBadge==='deficit');
  const over = Object.values(ds.skuMap).filter(s=>s.stockBadge==='overstock');
  lines.push(`Риск дефицита: ${deficit.length ? deficit.map(s=>`${s.sku} (${fmtNum(s.daysOfStock,1)} дн.)`).join(', ') : 'нет'}`);
  lines.push(`Избыточный запас: ${over.length ? over.map(s=>`${s.sku} (${fmtNum(s.daysOfStock,1)} дн.)`).join(', ') : 'нет'}`);
  lines.push('');

  lines.push('📢 РЕКЛАМА');
  const campaigns = Object.values(ds.campaigns);
  if(!campaigns.length) lines.push('Недостаточно данных.');
  else{
    const problems = campaigns.filter(c=> (c.adSpend>0 && !c.adOrders) || (c.drrDeltaPp!=null && c.drrDeltaPp>=DEFAULT_THRESHOLDS.drrDegradePp));
    const good = campaigns.filter(c=> c.drrPct!=null && (c.prev?.drrPct==null || c.drrPct<=c.prev.drrPct));
    lines.push(`Проблемные кампании: ${problems.length? problems.map(c=>c.campaign).join(', ') : 'нет'}`);
    lines.push(`Эффективные кампании: ${good.length? good.map(c=>c.campaign).join(', ') : 'Недостаточно данных для сравнения'}`);
  }
  lines.push('');

  lines.push('📈 ПРОГНОЗ');
  const forecastable = Object.values(ds.skuMap).filter(s=>s.daysOfStock!=null);
  if(forecastable.length){
    forecastable.filter(s=>s.stockBadge==='deficit').forEach(s=>{
      const d = new Date(); d.setDate(d.getDate()+Math.floor(s.daysOfStock));
      lines.push(`(прогноз) ${s.sku}: запас закончится ориентировочно ${d.toISOString().slice(0,10)}, если темп продаж не изменится.`);
    });
    if(!forecastable.some(s=>s.stockBadge==='deficit')) lines.push('Критичных прогнозов по остаткам нет.');
  } else {
    lines.push('Недостаточно данных для прогноза.');
  }
  lines.push('');

  lines.push('🎯 ТОП-3 ДЕЙСТВИЯ НА СЕГОДНЯ');
  const top3 = priorities.slice(0,3);
  if(!top3.length) lines.push('Критических проблем не обнаружено. Существенных действий на текущий момент не требуется.');
  else top3.forEach((p,i)=> lines.push(`${i+1}. ${p.title}`));
  lines.push('');

  lines.push('⚠️ ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ');
  const confirmItems = priorities.filter(p=>p.requiresConfirmation).slice(0,5);
  if(!confirmItems.length) lines.push('Нет.');
  else confirmItems.forEach((p,i)=> lines.push(`${i+1}. ${p.title}`));

  return lines.join('\n');
}

/* ---------- 11. ДЕКОРАЦИЯ / РЕНДЕР UI ---------- */

let STATE = { current:null, previous:null, priorities:[], adRecos:[], dateStr: todayStr() };
let SETTINGS = loadSettings();
let HISTORY = loadHistory();

function loadSettings(){
  try{
    const raw = localStorage.getItem('ozonAgent.settings');
    return raw ? Object.assign({}, DEFAULT_THRESHOLDS, JSON.parse(raw)) : Object.assign({}, DEFAULT_THRESHOLDS);
  }catch(e){ return Object.assign({}, DEFAULT_THRESHOLDS); }
}
function saveSettings(){ localStorage.setItem('ozonAgent.settings', JSON.stringify(SETTINGS)); }
function loadHistory(){
  try{ const raw = localStorage.getItem('ozonAgent.decisions'); return raw ? JSON.parse(raw) : []; }
  catch(e){ return []; }
}
function saveHistory(){ localStorage.setItem('ozonAgent.decisions', JSON.stringify(HISTORY)); }
function loadApiCreds(){
  try{
    const raw = localStorage.getItem('ozonAgent.apiCreds');
    return raw ? JSON.parse(raw) : { clientId:'', apiKey:'', proxyUrl:'' };
  }catch(e){ return { clientId:'', apiKey:'', proxyUrl:'' }; }
}
function saveApiCreds(){ localStorage.setItem('ozonAgent.apiCreds', JSON.stringify(API_CREDS)); }
let API_CREDS = loadApiCreds();

function loadPerfCreds(){
  try{
    const raw = localStorage.getItem('ozonAgent.perfCreds');
    return raw ? JSON.parse(raw) : { clientId:'', clientSecret:'' };
  }catch(e){ return { clientId:'', clientSecret:'' }; }
}
function savePerfCreds(){ localStorage.setItem('ozonAgent.perfCreds', JSON.stringify(PERF_CREDS)); }
let PERF_CREDS = loadPerfCreds();
let PERF_TOKEN = null; // { accessToken, expiresAt } — в памяти, не сохраняется

function process(){
  const currentRaw = buildDataset('current');
  if(!Object.keys(currentRaw.skuMap).length && !Object.keys(currentRaw.campaigns).length){
    log('Нет файлов с распознанным типом для текущего периода. Выберите тип файла вручную в списке выше.', true);
    return;
  }
  const previousRaw = queued.previous.length ? buildDataset('previous') : null;
  const current = computeDerived(currentRaw);
  const previous = previousRaw ? computeDerived(previousRaw) : null;
  if(previous) attachComparison(current, previous);

  Object.values(current.skuMap).forEach(rec=> classifySku(rec, SETTINGS));

  const adRecos = buildAdRecommendations(Object.values(current.campaigns), SETTINGS);
  const priorities = buildPriorities(current, adRecos);

  STATE = { current, previous, priorities, adRecos, dateStr: document.getElementById('report-date').value || todayStr() };
  persistState();
  renderAll();
  switchTab('report');
}

function persistState(){
  try{
    localStorage.setItem('ozonAgent.lastRun', JSON.stringify({dateStr: STATE.dateStr, savedAt: Date.now()}));
  }catch(e){}
}

function renderAll(){
  renderReport();
  renderSkuTable();
  renderFinanceTab();
  renderAdsTab();
  renderStockTab();
  renderHistoryTab();
}

function renderReport(){
  if(!STATE.current){ return; }
  const text = buildReportText(STATE.current, STATE.priorities, STATE.dateStr);
  document.getElementById('report-empty').hidden = true;
  const pre = document.getElementById('report-text');
  pre.hidden = false;
  pre.textContent = text;
}

function renderSkuTable(){
  const skus = STATE.current ? Object.values(STATE.current.skuMap) : [];
  document.getElementById('sku-empty').hidden = skus.length>0;
  document.getElementById('sku-table-wrap').hidden = skus.length===0;
  const tbody = document.querySelector('#sku-table tbody');
  tbody.innerHTML = '';
  skus.sort((a,b)=> (b.revenue||0)-(a.revenue||0));
  skus.forEach(rec=>{
    const perf = PERF_LABELS[rec.perfClass]||PERF_LABELS.unknown;
    const stockB = STOCK_LABELS[rec.stockBadge]||STOCK_LABELS.na;
    const tr = document.createElement('tr');
    tr.dataset.sku = rec.sku;
    tr.innerHTML = `
      <td>${escapeHtml(rec.sku)}</td>
      <td>${escapeHtml(rec.name||'—')}</td>
      <td><span class="badge ${perf.cls}">${perf.label}</span> <span class="badge ${stockB.cls}">${stockB.label}</span></td>
      <td>${rec.stock!=null?fmtNum(rec.stock,0):'—'}</td>
      <td>${fmtMoney(rec.revenue)}</td>
      <td>${rec.profit!=null?fmtMoney(rec.profit):'Недостаточно данных'}</td>
      <td>${fmtPct(rec.marginPct)}</td>
      <td>${fmtPct(rec.drrPct)}</td>
      <td>${rec.daysOfStock!=null?fmtNum(rec.daysOfStock,1):'—'}</td>
      <td>${rec.rating!=null?fmtNum(rec.rating,1):'—'}</td>`;
    tr.onclick = ()=> renderSkuDetail(rec);
    tbody.appendChild(tr);
  });
}

function renderSkuDetail(rec){
  const el = document.getElementById('sku-detail');
  el.hidden = false;
  const perf = PERF_LABELS[rec.perfClass]||PERF_LABELS.unknown;
  const stockB = STOCK_LABELS[rec.stockBadge]||STOCK_LABELS.na;
  const items = [
    ['Выручка', fmtMoney(rec.revenue)],
    ['Прибыль', rec.profit!=null?fmtMoney(rec.profit):'Недостаточно данных'],
    ['Маржинальность', fmtPct(rec.marginPct)],
    ['Заказы', rec.orders!=null?fmtNum(rec.orders,0):'Недостаточно данных'],
    ['Выкупы', rec.buyouts!=null?fmtNum(rec.buyouts,0):'Недостаточно данных'],
    ['Возвраты', rec.returns!=null?fmtNum(rec.returns,0):'Недостаточно данных'],
    ['Отмены', rec.cancellations!=null?fmtNum(rec.cancellations,0):'Недостаточно данных'],
    ['Остаток', rec.stock!=null?fmtNum(rec.stock,0):'Недостаточно данных'],
    ['Продажи/день', rec.avgSalesDay!=null?fmtNum(rec.avgSalesDay,2):'Недостаточно данных'],
    ['Дни запаса', rec.daysOfStock!=null?fmtNum(rec.daysOfStock,1):'Недостаточно данных'],
    ['ДРР', fmtPct(rec.drrPct)],
    ['CTR', fmtPct(rec.ctrPct)],
    ['Конверсия', fmtPct(rec.convPct)],
    ['Рейтинг', rec.rating!=null?fmtNum(rec.rating,1):'Недостаточно данных'],
  ];
  el.innerHTML = `
    <button class="close-x" id="sku-detail-close">✕</button>
    <h3>${escapeHtml(rec.sku)} — ${escapeHtml(rec.name||'без названия')}</h3>
    <span class="badge ${perf.cls}">${perf.label}</span> <span class="badge ${stockB.cls}">${stockB.label}</span>
    <div class="detail-grid">${items.map(([l,v])=>`<div class="detail-item"><div class="di-label">${l}</div><div class="di-value">${v}</div></div>`).join('')}</div>
    ${(rec.perfNotes&&rec.perfNotes.length)?`<div class="detail-note"><strong>Факты/причины:</strong> ${rec.perfNotes.join('; ')}</div>`:''}
    ${(rec.assumptions&&rec.assumptions.length)?`<div class="detail-note"><strong>Допущения:</strong> ${rec.assumptions.join('; ')}</div>`:''}
    ${(rec.stockNotes&&rec.stockNotes.length)?`<div class="detail-note"><strong>Остатки:</strong> ${rec.stockNotes.join('; ')}</div>`:''}
  `;
  document.getElementById('sku-detail-close').onclick = ()=> el.hidden = true;
  el.scrollIntoView({behavior:'smooth', block:'nearest'});
}

const FINANCE_CATEGORIES = [
  {key:'cogs', label:'Себестоимость', color:'#94A3B8'},
  {key:'commission', label:'Комиссия', color:'#F59E0B'},
  {key:'logistics', label:'Логистика', color:'#3B82F6'},
  {key:'crossdock', label:'Кросс-докинг', color:'#8B5CF6'},
  {key:'storage', label:'Хранение', color:'#EC4899'},
  {key:'adSpend', label:'Реклама', color:'#FF6A1A'},
  {key:'otherExpenses', label:'Прочее', color:'#64748B'},
];

function renderFinanceTab(){
  const skus = STATE.current ? Object.values(STATE.current.skuMap) : [];
  const hasAny = skus.some(s=> ['revenue','cost','commission','logistics','crossdock','storage','adSpend','otherExpenses','profit'].some(f=>s[f]!=null));
  document.getElementById('finance-empty').hidden = hasAny;
  document.getElementById('finance-content').hidden = !hasAny;
  if(!hasAny) return;

  const totals = { revenue: sum(skus.map(s=>s.revenue)) };
  FINANCE_CATEGORIES.forEach(c=>{ totals[c.key] = sum(skus.map(s=>s[c.key])); });
  totals.profit = sum(skus.filter(s=>s.profit!=null).map(s=>s.profit));
  const profitComplete = skus.length>0 && skus.every(s=>s.profit==null || s.profitComplete);

  const summaryItems = [
    ['Выручка', fmtMoney(totals.revenue)],
    ...FINANCE_CATEGORIES.map(c=>[c.label, fmtMoney(totals[c.key])]),
    ['Прибыль', totals.profit!=null ? fmtMoney(totals.profit) + (profitComplete?'':' (прибл.)') : 'Недостаточно данных'],
    ['Маржинальность', (totals.profit!=null && totals.revenue) ? fmtPct(totals.profit/totals.revenue*100) : 'Недостаточно данных'],
  ];
  document.getElementById('finance-summary').innerHTML = summaryItems.map(([l,v])=>
    `<div class="detail-item"><div class="di-label">${l}</div><div class="di-value">${v}</div></div>`
  ).join('');

  const barWrap = document.getElementById('finance-bar-wrap');
  const noteEl = document.getElementById('finance-bar-note');
  const segments = FINANCE_CATEGORIES
    .map(c=>({key:c.key, label:c.label, color:c.color, value: totals[c.key]}))
    .filter(c=> c.value!=null && c.value>0);
  if(totals.profit!=null && totals.profit>0) segments.push({key:'profit', label:'Прибыль', color:'#16A34A', value: totals.profit});
  const barTotal = sum(segments.map(s=>s.value));
  if(!segments.length || !barTotal){
    barWrap.innerHTML = '';
    noteEl.textContent = 'Недостаточно данных для разбивки — нужны хотя бы себестоимость и одна статья расходов.';
  } else {
    barWrap.innerHTML = `<div class="finance-bar">${segments.map(s=>
      `<div class="finance-bar-seg" style="width:${(s.value/barTotal*100).toFixed(2)}%;background:${s.color}" title="${escapeHtml(s.label)}: ${fmtMoney(s.value)}"></div>`
    ).join('')}</div>
    <div class="finance-legend">${segments.map(s=>
      `<div class="finance-legend-item"><span class="finance-swatch" style="background:${s.color}"></span>${escapeHtml(s.label)}: ${fmtMoney(s.value)} (${(s.value/barTotal*100).toFixed(1)}%)</div>`
    ).join('')}</div>`;
    const missingCats = FINANCE_CATEGORIES.filter(c=> totals[c.key]==null).map(c=>c.label);
    noteEl.textContent = missingCats.length
      ? `Не хватает данных по: ${missingCats.join(', ')} — эти статьи не включены в разбивку (не считаются нулевыми).`
      : (profitComplete?'':'Прибыль приблизительная — не по каждому SKU учтены все статьи расходов.');
  }

  const tbody = document.querySelector('#finance-table tbody');
  tbody.innerHTML = '';
  const sorted = skus.slice().sort((a,b)=>(b.revenue||0)-(a.revenue||0));
  sorted.forEach(s=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(s.sku)}</td>
      <td>${escapeHtml(s.name||'—')}</td>
      <td>${fmtMoney(s.revenue)}</td>
      <td>${fmtMoney(s.cogs)}</td>
      <td>${fmtMoney(s.commission)}</td>
      <td>${fmtMoney(s.logistics)}</td>
      <td>${fmtMoney(s.crossdock)}</td>
      <td>${fmtMoney(s.storage)}</td>
      <td>${fmtMoney(s.adSpend)}</td>
      <td>${fmtMoney(s.otherExpenses)}</td>
      <td>${s.profit!=null?fmtMoney(s.profit):'Недостаточно данных'}</td>
      <td>${fmtPct(s.marginPct)}</td>`;
    tbody.appendChild(tr);
  });
}

function renderAdsTab(){
  const campaigns = STATE.current ? Object.values(STATE.current.campaigns) : [];
  document.getElementById('ads-empty').hidden = campaigns.length>0;
  document.getElementById('ads-content').hidden = campaigns.length===0;
  const tbody = document.querySelector('#ads-table tbody');
  tbody.innerHTML = '';
  campaigns.sort((a,b)=>(b.adSpend||0)-(a.adSpend||0));
  campaigns.forEach(c=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(c.campaign)}</td>
      <td>${fmtMoney(c.adSpend)}</td>
      <td>${c.impressions!=null?fmtNum(c.impressions,0):'—'}</td>
      <td>${c.clicks!=null?fmtNum(c.clicks,0):'—'}</td>
      <td>${fmtPct(c.ctrPct)}</td>
      <td>${c.adOrders!=null?fmtNum(c.adOrders,0):'—'}</td>
      <td>${c.adRevenue!=null?fmtMoney(c.adRevenue):'Недостаточно данных'}</td>
      <td>${fmtPct(c.drrPct)}</td>`;
    tbody.appendChild(tr);
  });
  const recoWrap = document.getElementById('ads-recommendations');
  recoWrap.innerHTML = '';
  if(!STATE.adRecos.length){
    recoWrap.innerHTML = '<div class="empty-state">Явных проблем или точек роста в рекламе не найдено.</div>';
  } else {
    STATE.adRecos.forEach(r=> recoWrap.appendChild(renderRecoCard(r)));
  }
}

function renderStockTab(){
  const skus = STATE.current ? Object.values(STATE.current.skuMap) : [];
  document.getElementById('stock-empty').hidden = skus.length>0;
  document.getElementById('stock-table-wrap').hidden = skus.length===0;
  const tbody = document.querySelector('#stock-table tbody');
  tbody.innerHTML = '';
  skus.sort((a,b)=>(a.daysOfStock??Infinity)-(b.daysOfStock??Infinity));
  skus.forEach(rec=>{
    const stockB = STOCK_LABELS[rec.stockBadge]||STOCK_LABELS.na;
    let recoText = '—';
    if(rec.stockBadge==='deficit' && rec.avgSalesDay!=null){
      const leadTime = rec.leadTimeDays!=null ? rec.leadTimeDays : SETTINGS.lowStockDaysDefault;
      const needed = rec.avgSalesDay*(leadTime+SETTINGS.safetyDays) - (rec.stock||0) - (rec.inTransit||0);
      recoText = needed>0 ? `Заказать ≈ ${Math.ceil(needed)} шт. (с учётом страхового запаса ${SETTINGS.safetyDays} дн.)` : 'Пополнение не требуется по расчёту';
    } else if(rec.stockBadge==='overstock'){
      recoText = 'Рассмотреть промо / приостановить поставки';
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(rec.sku)}</td>
      <td>${escapeHtml(rec.name||'—')}</td>
      <td>${rec.stock!=null?fmtNum(rec.stock,0):'—'}</td>
      <td>${rec.inTransit!=null?fmtNum(rec.inTransit,0):'—'}</td>
      <td>${rec.avgSalesDay!=null?fmtNum(rec.avgSalesDay,2):'—'}</td>
      <td>${rec.daysOfStock!=null?fmtNum(rec.daysOfStock,1):'—'}</td>
      <td>${rec.leadTimeDays!=null?fmtNum(rec.leadTimeDays,0):'не указан'}</td>
      <td><span class="badge ${stockB.cls}">${stockB.label}</span></td>
      <td>${recoText}</td>`;
    tbody.appendChild(tr);
  });
}

function renderRecoCard(r, opts){
  opts = opts||{};
  const div = document.createElement('div');
  div.className = 'reco-card level-'+r.level;
  const actionsHtml = (r.requiresConfirmation && r.confirmText) ? `
    <div class="reco-actions">
      <button class="btn btn-primary btn-small" data-confirm-yes="1">Подтвердить</button>
      <button class="btn btn-ghost btn-small" data-confirm-no="1">Отклонить</button>
    </div>` : '';
  div.innerHTML = `
    <div class="reco-title"><span>${escapeHtml(r.title)}</span>${r.requiresConfirmation?'<span class="assumption">требует подтверждения</span>':''}</div>
    <div class="reco-body">${r.body.map(l=>`<p>${escapeHtml(l)}</p>`).join('')}</div>
    ${actionsHtml}`;
  if(r.requiresConfirmation && r.confirmText){
    div.querySelector('[data-confirm-yes]').onclick = ()=>{
      HISTORY.unshift({
        id: uid(), date: STATE.dateStr, target: r.title, metric:'', before:'', change:r.confirmText,
        after:'', reason:r.body[2]||'', expectedEffect:r.body[3]||'', actualEffect:'', conclusion:'',
        status:'confirmed', source:'confirmed',
      });
      saveHistory();
      renderHistoryTab();
      div.remove();
    };
    div.querySelector('[data-confirm-no]').onclick = ()=>{ div.remove(); };
  }
  return div;
}

function renderHistoryTab(){
  const queueWrap = document.getElementById('confirm-queue');
  queueWrap.innerHTML = '';
  const pending = STATE.priorities.filter(p=>p.requiresConfirmation && p.confirmText);
  document.getElementById('confirm-empty').hidden = pending.length>0;
  pending.forEach(p=> queueWrap.appendChild(renderRecoCard(p)));

  const tbody = document.querySelector('#history-table tbody');
  tbody.innerHTML = '';
  HISTORY.forEach(h=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(h.date||'')}</td>
      <td>${escapeHtml(h.target||'')}</td>
      <td>${escapeHtml(h.metric||'')}</td>
      <td>${escapeHtml(String(h.before??''))}</td>
      <td>${escapeHtml(h.change||'')}</td>
      <td>${escapeHtml(String(h.after??''))}</td>
      <td>${escapeHtml(h.reason||'')}</td>
      <td>${escapeHtml(h.expectedEffect||'')}</td>
      <td>${escapeHtml(h.actualEffect||'')}</td>
      <td>${escapeHtml(h.conclusion|| (h.status==='confirmed' && !h.actualEffect ? '⚪ Недостаточно данных для оценки результата' : ''))}</td>
      <td><button class="btn btn-ghost btn-small" data-eval="${h.id}">Оценить результат</button></td>`;
    tbody.appendChild(tr);
  });
  document.querySelectorAll('[data-eval]').forEach(btn=>{
    btn.onclick = ()=> openEvalDialog(btn.dataset.eval);
  });
}

function openEvalDialog(id){
  const h = HISTORY.find(x=>x.id===id);
  if(!h) return;
  const after = prompt('Фактическое значение показателя ПОСЛЕ изменения (оставьте пустым, если пока рано оценивать):', h.after||'');
  if(after===null) return;
  h.after = after;
  if(after===''){ h.conclusion = '⚪ Недостаточно данных для оценки результата.'; }
  else{
    const beforeNum = parseNumber(h.before);
    const afterNum = parseNumber(after);
    if(beforeNum!=null && afterNum!=null){
      const diff = afterNum-beforeNum;
      h.actualEffect = `${diff>=0?'+':''}${fmtNum(diff,2)}`;
      h.conclusion = diff>0 ? '🟢 Решение показало положительный результат.' : (diff<0 ? '🔴 Решение показало отрицательный результат.' : '⚪ Изменений не зафиксировано.');
    } else {
      h.conclusion = 'Оценка внесена вручную — сравните «До» и «После» самостоятельно, числовое сравнение недоступно.';
    }
  }
  saveHistory();
  renderHistoryTab();
}

/* ---------- 12. ШАБЛОНЫ XLSX ---------- */

function downloadTemplates(){
  const wb = XLSX.utils.book_new();
  const sheets = {
    'Продажи': ['SKU','Название','Дата','Заказано на сумму','Заказы','Выкупы','Возвраты','Отмены','Просмотры карточки','Добавления в корзину'],
    'Остатки': ['SKU','Название','Остаток','В пути','Средние продажи в день','Срок поставки'],
    'Реклама': ['Кампания','SKU','Дата','Показы','Клики','Расход','Заказы с рекламы','Рекламные продажи'],
    'Финансы': ['SKU','Комиссия','Логистика','Кросс-докинг','Хранение','Прочие расходы','Прибыль'],
    'Себестоимость': ['SKU','Себестоимость'],
    'Поставки': ['SKU','Срок поставки','В пути'],
    'Товары': ['SKU','Название','Категория','Цена','Минимальная цена','Целевая маржинальность','Целевой ДРР'],
    'Отзывы': ['SKU','Рейтинг','Количество отзывов'],
    'История решений': ['Дата','SKU или кампания','Изменение','Показатель до','Показатель после','Причина','Ожидаемый эффект','Фактический эффект','Вывод'],
  };
  Object.keys(sheets).forEach(name=>{
    const header = sheets[name];
    const ws = XLSX.utils.aoa_to_sheet([header, header.map(()=>'')]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, 'ozon-agent-shablony.xlsx');
}

// Выгружает реальные SKU/названия из уже загруженных данных (а не из
// придуманного примера) — колонка "Себестоимость" остаётся пустой, чтобы
// владелец магазина сам её заполнил без риска опечататься в артикуле.
function downloadCostTemplate(){
  if(!STATE.current || !Object.keys(STATE.current.skuMap).length){
    alert('Сначала загрузите остатки/товары и нажмите «Обработать данные», чтобы список SKU был доступен.');
    return;
  }
  const skus = Object.values(STATE.current.skuMap).sort((a,b)=> String(a.sku).localeCompare(String(b.sku)));
  const header = ['SKU','Название','Себестоимость'];
  const rows = skus.map(s=>[s.sku, s.name||'', s.cost!=null?s.cost:'']);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Себестоимость');
  XLSX.writeFile(wb, `ozon-sebestoimost-${STATE.dateStr}.xlsx`);
}

/* ---------- 13. ВКЛАДКИ / МОДАЛКИ ---------- */

function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===name));
  document.querySelectorAll('.panel').forEach(p=> p.classList.toggle('active', p.id==='panel-'+name));
}

function renderHelp(){
  const wrap = document.getElementById('help-columns');
  wrap.innerHTML = HELP_COLUMNS.map(([key,label,cols])=>`
    <div class="help-card"><h3>${escapeHtml(label)}</h3><div class="muted">${escapeHtml(cols)}</div></div>
  `).join('');
}

function openSettings(){
  document.getElementById('set-lowstock').value = SETTINGS.lowStockDaysDefault;
  document.getElementById('set-overstock').value = SETTINGS.overstockDaysDefault;
  document.getElementById('set-decline-warn').value = SETTINGS.declineWarnPct;
  document.getElementById('set-decline-bad').value = SETTINGS.declineBadPct;
  document.getElementById('set-growth').value = SETTINGS.growthPct;
  document.getElementById('set-drr-degrade').value = SETTINGS.drrDegradePp;
  document.getElementById('set-target-margin').value = SETTINGS.targetMarginDefault;
  document.getElementById('set-safety-days').value = SETTINGS.safetyDays;
  document.getElementById('settings-overlay').hidden = false;
}

/* ---------- 14. OZON SELLER API (через прокси, см. agent/proxy/cloudflare-worker.js) ---------- */

const OZON_API_TIMEOUT_MS = 20000;
let SKU_ID_MAP = {}; // numeric Ozon SKU (string) -> offer_id (артикул продавца)

function apiLog(msg, isErr){
  const el = document.getElementById('api-status');
  if(!el) return;
  const line = document.createElement('div');
  line.className = isErr ? 'log-err' : 'log-ok';
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function ozonFetchOnce(path, body){
  if(!API_CREDS.proxyUrl) throw new Error('Не указан адрес прокси-сервера (см. вкладку «Справка»).');
  if(!API_CREDS.clientId || !API_CREDS.apiKey) throw new Error('Не указаны Client-Id / Api-Key.');
  const base = API_CREDS.proxyUrl.replace(/\/+$/,'');
  const url = `${base}/seller/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(()=> controller.abort(), OZON_API_TIMEOUT_MS);
  let res;
  try{
    res = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Client-Id':API_CREDS.clientId, 'Api-Key':API_CREDS.apiKey },
      body: JSON.stringify(body||{}),
      signal: controller.signal,
    });
  }catch(err){
    if(err.name==='AbortError') throw new Error(`Превышено время ожидания (${OZON_API_TIMEOUT_MS/1000} c). Проверьте адрес прокси-сервера.`);
    throw new Error(`Не удалось обратиться к прокси-серверу: ${err.message}. Проверьте, что адрес указан верно и воркер развёрнут.`);
  }finally{
    clearTimeout(timer);
  }
  const text = await res.text();
  let json = null;
  try{ json = text ? JSON.parse(text) : null; }catch(e){ /* не JSON — оставим text для сообщения об ошибке */ }
  if(!res.ok){
    const detail = (json && (json.message || json.code)) ? `${json.code||''} ${json.message||''}`.trim() : text.slice(0,300);
    const err = new Error(`Ozon API вернул ошибку ${res.status}: ${detail || 'без подробностей'}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// Ozon ограничивает число запросов в секунду — при 429 подождём и повторим (до 2 раз).
async function ozonFetch(path, body){
  const delays = [1200, 2500];
  for(let attempt=0; ; attempt++){
    try{
      return await ozonFetchOnce(path, body);
    }catch(err){
      if(err.status===429 && attempt<delays.length){
        apiLog(`⏳ Ozon просит притормозить (лимит запросов), повтор через ${delays[attempt]/1000} c…`);
        await sleep(delays[attempt]);
        continue;
      }
      throw err;
    }
  }
}

async function testApiConnection(){
  const el = document.getElementById('api-status');
  el.innerHTML = '';
  apiLog('Проверяю подключение…');
  try{
    await ozonFetch('v4/product/info/stocks', {filter:{visibility:'ALL'}, limit:1, cursor:''});
    apiLog('✅ Подключение работает — Ozon ответил на запрос остатков.');
  }catch(err){
    apiLog('❌ ' + err.message, true);
  }
}

// Пробует несколько вариантов пути метода по очереди (у Ozon версии методов
// время от времени меняются) — берёт первый, который не вернул 404.
async function ozonFetchAny(paths, body){
  let lastErr;
  for(const path of paths){
    try{
      return { data: await ozonFetch(path, body), path };
    }catch(err){
      lastErr = err;
      if(!/вернул ошибку 404/.test(err.message)) throw err; // не 404 — нет смысла перебирать дальше
    }
  }
  throw lastErr;
}

// Список offer_id/product_id всего каталога (постранично через last_id).
// Ozon менял путь этого метода между версиями — пробуем v3, затем v2.
async function fetchAllOfferIds(){
  const offerIds = [];
  let lastId = '';
  let path = 'v3/product/list';
  for(let page=0; page<20; page++){
    const {data:resp, path:usedPath} = await ozonFetchAny([path, 'v2/product/list'], {filter:{visibility:'ALL'}, limit:1000, last_id:lastId});
    path = usedPath; // на следующих страницах сразу используем тот, что сработал
    const items = (resp && resp.result && resp.result.items) || [];
    items.forEach(it=>{ if(it.offer_id) offerIds.push(it.offer_id); });
    lastId = resp && resp.result && resp.result.last_id;
    if(!lastId || items.length===0) break;
  }
  return offerIds;
}

// Название и числовые SKU (fbo/fbs) по списку offer_id, батчами.
// Пробуем v2/product/info/list, затем v3/product/info/list.
async function fetchProductInfoBatch(offerIds){
  const items = [];
  let path = 'v2/product/info/list';
  for(let i=0;i<offerIds.length;i+=100){
    const batch = offerIds.slice(i,i+100);
    const {data:resp, path:usedPath} = await ozonFetchAny([path, 'v3/product/info/list'], {offer_id:batch});
    path = usedPath;
    const respItems = (resp && resp.items) || (resp && resp.result && resp.result.items) || [];
    items.push(...respItems);
  }
  return items;
}

function extractNumericSkus(item){
  const ids = [];
  ['sku','fbo_sku','fbs_sku'].forEach(f=>{ if(item[f]) ids.push(String(item[f])); });
  if(Array.isArray(item.sources)){
    item.sources.forEach(s=>{ if(s && s.sku) ids.push(String(s.sku)); });
  }
  return ids;
}

async function apiPullStocks(period){
  apiLog(`Загружаю остатки (${period==='current'?'текущий':'предыдущий'} период)…`);
  try{
    const rows = [];
    let cursor = '';
    for(let page=0; page<20; page++){
      const resp = await ozonFetch('v4/product/info/stocks', {filter:{visibility:'ALL'}, limit:1000, cursor});
      const items = (resp && resp.items) || (resp && resp.result && resp.result.items) || [];
      items.forEach(it=>{
        if(!it.offer_id) return;
        const present = sum((it.stocks||[]).map(s=>parseNumber(s.present)));
        rows.push({sku: it.offer_id, stock: present});
      });
      cursor = resp && resp.cursor;
      if(!cursor || items.length===0) break;
    }
    if(!rows.length){ apiLog('⚠️ Ozon вернул пустой список остатков.', true); return; }
    pushApiEntry(period, `Остатки из Ozon API (${rows.length})`, 'stocks', rows);
    apiLog(`✅ Остатки загружены: ${rows.length} SKU.`);
  }catch(err){ apiLog('❌ ' + err.message, true); }
}

async function apiPullProducts(period){
  apiLog(`Загружаю товары (${period==='current'?'текущий':'предыдущий'} период)…`);
  try{
    const stocksEntry = queued[period].find(i=> i.fromApi && i.apiType==='stocks');
    let offerIds = stocksEntry ? stocksEntry.canonicalRows.map(r=>r.sku).filter(Boolean) : [];
    if(offerIds.length) apiLog(`Использую список SKU из уже загруженных остатков (${offerIds.length}) — каталог заново не запрашиваю.`);
    else offerIds = await fetchAllOfferIds();
    if(!offerIds.length){ apiLog('⚠️ Ozon вернул пустой каталог товаров.', true); return; }
    const infos = await fetchProductInfoBatch(offerIds);
    const rows = [];
    SKU_ID_MAP = {};
    infos.forEach(item=>{
      if(!item.offer_id) return;
      rows.push({sku:item.offer_id, name:item.name||null});
      extractNumericSkus(item).forEach(id=> SKU_ID_MAP[id] = item.offer_id);
    });
    pushApiEntry(period, `Товары из Ozon API (${rows.length})`, 'products', rows);
    apiLog(`✅ Товары загружены: ${rows.length}. Сопоставление SKU для аналитики продаж обновлено.`);
  }catch(err){ apiLog('❌ ' + err.message, true); }
}

async function apiPullSales(period, dateFrom, dateTo){
  if(!dateFrom || !dateTo){ apiLog('❌ Укажите даты «с» и «по».', true); return; }
  apiLog(`Загружаю продажи с ${dateFrom} по ${dateTo} (${period==='current'?'текущий':'предыдущий'} период)…`);
  try{
    if(!Object.keys(SKU_ID_MAP).length){
      apiLog('Сопоставление SKU ещё не загружено — сначала подтягиваю список товаров…');
      await apiPullProducts(period);
    }
    const metrics = ['revenue','ordered_units','returns','cancellations'];
    const rows = [];
    const warnings = [];
    let offset = 0;
    for(let page=0; page<20; page++){
      const resp = await ozonFetch('v1/analytics/data', {date_from:dateFrom, date_to:dateTo, metrics, dimension:['sku'], limit:1000, offset});
      const data = (resp && resp.result && resp.result.data) || [];
      data.forEach(row=>{
        const rawId = row.dimensions && row.dimensions[0] && String(row.dimensions[0].id);
        if(!rawId) return;
        const mapped = SKU_ID_MAP[rawId];
        if(!mapped) warnings.push(`SKU не сопоставлен: внутренний ID Ozon ${rawId} — показан как есть, проверьте вручную.`);
        const [revenue, orders, returns, cancellations] = row.metrics||[];
        rows.push({sku: mapped||rawId, revenue, orders, returns, cancellations});
      });
      offset += 1000;
      if(data.length < 1000) break;
    }
    if(!rows.length){ apiLog('⚠️ Ozon не вернул данных о продажах за указанный период.', true); return; }
    const msFrom = new Date(dateFrom), msTo = new Date(dateTo);
    const dayCount = Math.max(1, Math.round((msTo-msFrom)/86400000) + 1);
    pushApiEntry(period, `Продажи из Ozon API (${rows.length})`, 'sales', rows, dayCount, warnings);
  }catch(err){ apiLog('❌ ' + err.message, true); }
}

async function apiPullReviews(period){
  apiLog(`Загружаю отзывы (${period==='current'?'текущий':'предыдущий'} период)…`);
  try{
    if(!Object.keys(SKU_ID_MAP).length){
      apiLog('Сопоставление SKU ещё не загружено — сначала подтягиваю список товаров…');
      await apiPullProducts(period);
    }
    const items = [];
    let lastId = '';
    for(let page=0; page<20; page++){
      const {data:resp} = await ozonFetchAny(['v1/review/list'], {limit:100, last_id:lastId, sort_dir:'DESC'});
      const pageItems = (resp && resp.reviews) || (resp && resp.result && resp.result.reviews) || [];
      items.push(...pageItems);
      lastId = (resp && resp.last_id) || (resp && resp.result && resp.result.last_id) || '';
      if(!lastId || pageItems.length===0) break;
    }
    if(!items.length){ apiLog('⚠️ Ozon не вернул отзывов — либо их правда нет за этот период, либо метод недоступен на вашем тарифе (нужен Premium/Premium Plus).', true); return; }
    const bySku = {};
    const warnings = [];
    items.forEach(it=>{
      const rawId = it.sku!=null ? String(it.sku) : (it.product_id!=null ? String(it.product_id) : null);
      if(!rawId) return;
      const mapped = SKU_ID_MAP[rawId];
      if(!mapped && !warnings.some(w=>w.includes(rawId))) warnings.push(`Отзыв на несопоставленный SKU: внутренний ID Ozon ${rawId} — показан как есть.`);
      const sku = mapped || rawId;
      const rating = parseNumber(it.rating ?? it.score ?? it.grade ?? it.stars);
      if(!bySku[sku]) bySku[sku] = {sum:0, count:0, total:0};
      bySku[sku].total += 1;
      if(rating!=null){ bySku[sku].sum += rating; bySku[sku].count += 1; }
    });
    const rows = Object.keys(bySku).map(sku=>({
      sku,
      rating: bySku[sku].count ? +(bySku[sku].sum/bySku[sku].count).toFixed(2) : null,
      reviewsCount: bySku[sku].total,
    }));
    pushApiEntry(period, `Отзывы из Ozon API (${items.length} шт., ${rows.length} SKU)`, 'reviews', rows, null, warnings);
    apiLog(`✅ Отзывы загружены: ${items.length} шт. по ${rows.length} SKU.`);
  }catch(err){ apiLog('❌ ' + err.message + ' — возможно, метод отзывов недоступен на вашем тарифе Ozon.', true); }
}

const FINANCE_KEYWORDS = {
  crossdock: ['кросс-докинг','кроссдокинг','crossdock','cross dock','cross-dock','докинг'],
  commission: ['комисс','commission','agent'],
  logistics: ['логист','logistic','delivery','доставк','перевозк'],
  storage: ['хранен','storage'],
};
function categorizeFinanceLine(name){
  const n = normalize(name);
  for(const cat in FINANCE_KEYWORDS){
    if(FINANCE_KEYWORDS[cat].some(k=> n.includes(normalize(k)))) return cat;
  }
  return 'other';
}

// Разбивка по статьям — приблизительная категоризация по названию операции
// в выписке Ozon, а не бухгалтерская проводка. Явно помечается допущением.
async function apiPullFinance(period, dateFrom, dateTo){
  if(!dateFrom || !dateTo){ apiLog('❌ Укажите даты «с» и «по».', true); return; }
  apiLog(`Загружаю финансы с ${dateFrom} по ${dateTo} (${period==='current'?'текущий':'предыдущий'} период)…`);
  try{
    if(!Object.keys(SKU_ID_MAP).length){
      apiLog('Сопоставление SKU ещё не загружено — сначала подтягиваю список товаров…');
      await apiPullProducts(period);
    }
    const bySku = {};
    const warnings = [];
    let page = 1;
    for(let p=0; p<20; p++){
      const resp = await ozonFetch('v3/finance/transaction/list', {
        filter: { date: {from: dateFrom+'T00:00:00.000Z', to: dateTo+'T23:59:59.999Z'}, transaction_type:'all' },
        page, page_size: 1000,
      });
      const ops = (resp && resp.result && resp.result.operations) || [];
      ops.forEach(op=>{
        const rawIds = (op.items||[]).map(it=> it.sku!=null ? String(it.sku) : null).filter(Boolean);
        rawIds.forEach(id=>{ if(!SKU_ID_MAP[id] && !warnings.some(w=>w.includes(id))) warnings.push(`Операция на несопоставленный SKU: внутренний ID Ozon ${id} — показан как есть.`); });
        const targets = rawIds.length ? rawIds.map(id=> SKU_ID_MAP[id]||id) : null;
        if(!targets) return; // операцию нельзя привязать ни к одному SKU — пропускаем, а не гадаем
        const lines = [];
        if(op.sale_commission){ lines.push({name:'commission', amount:-Math.abs(parseNumber(op.sale_commission)||0)}); }
        (op.services||[]).forEach(s=> lines.push({name:s.name||'', amount: parseNumber(s.price)}));
        lines.forEach(line=>{
          const amt = Math.abs(line.amount||0);
          if(!amt) return;
          const cat = line.name==='commission' ? 'commission' : categorizeFinanceLine(line.name);
          const share = amt / targets.length;
          targets.forEach(sku=>{
            if(!bySku[sku]) bySku[sku] = {commission:0, logistics:0, crossdock:0, storage:0, otherExpenses:0};
            if(cat==='commission') bySku[sku].commission += share;
            else if(cat==='crossdock') bySku[sku].crossdock += share;
            else if(cat==='logistics') bySku[sku].logistics += share;
            else if(cat==='storage') bySku[sku].storage += share;
            else bySku[sku].otherExpenses += share;
          });
        });
      });
      const pageCount = resp && resp.result && resp.result.page_count;
      page += 1;
      if(!pageCount || page > pageCount) break;
    }
    const rows = Object.keys(bySku).map(sku=>({sku, ...bySku[sku]}));
    if(!rows.length){ apiLog('⚠️ Ozon не вернул финансовых операций за период (или ни одну не удалось привязать к SKU).', true); return; }
    warnings.push('Разбивка на комиссию/логистику/хранение — приблизительная категоризация по названию операции в выписке Ozon, не бухгалтерская проводка.');
    pushApiEntry(period, `Финансы из Ozon API (${rows.length} SKU, приблизительно)`, 'finance', rows, null, warnings);
    apiLog(`✅ Финансы загружены: ${rows.length} SKU. Разбивка по статьям приблизительная — сверяйте при сомнениях.`);
  }catch(err){ apiLog('❌ ' + err.message, true); }
}

/* ---------- 14b. OZON PERFORMANCE API (реклама, через тот же прокси) ---------- */

function perfLog(msg, isErr){
  const el = document.getElementById('perf-status');
  if(!el) return;
  const line = document.createElement('div');
  line.className = isErr ? 'log-err' : 'log-ok';
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

async function perfRawFetch(path, method, body, authHeader){
  if(!API_CREDS.proxyUrl) throw new Error('Не указан адрес прокси-сервера (заполняется в блоке Seller API выше).');
  const base = API_CREDS.proxyUrl.replace(/\/+$/,'');
  const url = `${base}/performance/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(()=> controller.abort(), OZON_API_TIMEOUT_MS);
  const headers = {'Content-Type':'application/json'};
  if(authHeader) headers['Authorization'] = authHeader;
  let res;
  try{
    res = await fetch(url, { method, headers, body: body?JSON.stringify(body):undefined, signal: controller.signal });
  }catch(err){
    if(err.name==='AbortError') throw new Error(`Превышено время ожидания (${OZON_API_TIMEOUT_MS/1000} c).`);
    throw new Error(`Не удалось обратиться к прокси-серверу: ${err.message}. Если недавно обновляли код воркера для Seller API — обновите его ещё раз (нужна версия с поддержкой /performance/).`);
  }finally{ clearTimeout(timer); }
  const text = await res.text();
  let json = null;
  try{ json = text ? JSON.parse(text) : null; }catch(e){}
  if(!res.ok){
    const detail = (json && (json.message || json.error || json.code)) ? `${json.code||json.error||''} ${json.message||''}`.trim() : text.slice(0,300);
    throw new Error(`Performance API вернул ошибку ${res.status}: ${detail || 'без подробностей'}`);
  }
  return json;
}

async function getPerfToken(force){
  if(!force && PERF_TOKEN && PERF_TOKEN.expiresAt > Date.now()+5000) return PERF_TOKEN.accessToken;
  if(!PERF_CREDS.clientId || !PERF_CREDS.clientSecret) throw new Error('Не указаны Client-Id / Client-Secret для Performance API.');
  const resp = await perfRawFetch('api/client/token', 'POST', {
    client_id: PERF_CREDS.clientId, client_secret: PERF_CREDS.clientSecret, grant_type: 'client_credentials',
  });
  const token = resp && (resp.access_token || resp.accessToken);
  if(!token) throw new Error('Ozon не вернул токен доступа (Performance API) — проверьте Client-Id/Client-Secret.');
  const expiresInSec = (resp && (resp.expires_in || resp.expiresIn)) || 1800;
  PERF_TOKEN = { accessToken: token, expiresAt: Date.now() + expiresInSec*1000 };
  return token;
}

async function perfFetch(path, method, body){
  const token = await getPerfToken(false);
  return perfRawFetch(path, method||'GET', body, `Bearer ${token}`);
}

async function testPerfConnection(){
  const el = document.getElementById('perf-status');
  el.innerHTML = '';
  perfLog('Проверяю подключение к Performance API…');
  try{
    await getPerfToken(true);
    perfLog('✅ Токен получен — ключи верны.');
  }catch(err){ perfLog('❌ ' + err.message, true); }
}

const CAMPAIGN_STATE_LABELS = {
  CAMPAIGN_STATE_RUNNING: 'идёт',
  CAMPAIGN_STATE_PLANNED: 'запланирована',
  CAMPAIGN_STATE_STOPPED: 'остановлена',
  CAMPAIGN_STATE_INACTIVE: 'неактивна',
  CAMPAIGN_STATE_ARCHIVED: 'в архиве',
  CAMPAIGN_STATE_MODERATION_DRAFT: 'черновик',
  CAMPAIGN_STATE_FINISHED: 'завершена',
};

let PERF_CAMPAIGNS_CACHE = [];

async function apiPullCampaignsList(period){
  perfLog(`Загружаю список кампаний (${period==='current'?'текущий':'предыдущий'} период)…`);
  try{
    const resp = await perfFetch('api/client/campaign', 'GET');
    const items = (resp && resp.list) || (resp && resp.campaigns) || (resp && resp.result) || [];
    if(!Array.isArray(items) || !items.length){ perfLog('⚠️ Ozon не вернул ни одной кампании.', true); return; }
    PERF_CAMPAIGNS_CACHE = items;
    perfLog(`✅ Кампаний найдено: ${items.length}.`);
    items.forEach(c=>{
      const state = CAMPAIGN_STATE_LABELS[c.state] || c.state || '—';
      const budget = c.dailyBudget!=null ? `дневной бюджет ${fmtMoney(parseNumber(c.dailyBudget)/1000000)}` : (c.budget!=null ? `бюджет ${fmtMoney(parseNumber(c.budget)/1000000)}` : 'бюджет не указан');
      perfLog(`• ${c.title||c.id} — ${state}, ${budget}`);
    });
  }catch(err){ perfLog('❌ ' + err.message, true); }
}

async function perfFetchText(path, method){
  const token = await getPerfToken(false);
  if(!API_CREDS.proxyUrl) throw new Error('Не указан адрес прокси-сервера.');
  const base = API_CREDS.proxyUrl.replace(/\/+$/,'');
  const url = `${base}/performance/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(()=> controller.abort(), OZON_API_TIMEOUT_MS);
  let res;
  try{
    res = await fetch(url, { method: method||'GET', headers:{'Authorization':`Bearer ${token}`}, signal: controller.signal });
  }catch(err){
    if(err.name==='AbortError') throw new Error(`Превышено время ожидания (${OZON_API_TIMEOUT_MS/1000} c).`);
    throw new Error(`Не удалось обратиться к прокси-серверу: ${err.message}`);
  }finally{ clearTimeout(timer); }
  const text = await res.text();
  if(!res.ok) throw new Error(`Performance API вернул ошибку ${res.status}: ${text.slice(0,300)}`);
  return text;
}

async function perfFetchBinary(path, method){
  const token = await getPerfToken(false);
  if(!API_CREDS.proxyUrl) throw new Error('Не указан адрес прокси-сервера.');
  const base = API_CREDS.proxyUrl.replace(/\/+$/,'');
  const url = `${base}/performance/${path}`;
  const controller = new AbortController();
  const timer = setTimeout(()=> controller.abort(), OZON_API_TIMEOUT_MS);
  let res;
  try{
    res = await fetch(url, { method: method||'GET', headers:{'Authorization':`Bearer ${token}`}, signal: controller.signal });
  }catch(err){
    if(err.name==='AbortError') throw new Error(`Превышено время ожидания (${OZON_API_TIMEOUT_MS/1000} c).`);
    throw new Error(`Не удалось обратиться к прокси-серверу: ${err.message}`);
  }finally{ clearTimeout(timer); }
  if(!res.ok){ const t = await res.text(); throw new Error(`Performance API вернул ошибку ${res.status}: ${t.slice(0,300)}`); }
  return await res.arrayBuffer();
}

// Минимальный разбор ZIP (без внешних библиотек): читает центральный
// каталог с конца архива, затем для каждой записи находит локальный
// заголовок и распаковывает данные (stored или deflate — через нативный
// DecompressionStream). Ozon отдаёт отчёты Performance API в ZIP.
async function unzipEntries(arrayBuffer){
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const maxBack = Math.min(bytes.length, 65557);
  let eocd = -1;
  for(let i=bytes.length-22; i>=bytes.length-maxBack; i--){
    if(i<0) break;
    if(view.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd<0) throw new Error('Не похоже на ZIP-архив (не найден конец центрального каталога).');
  const entryCount = view.getUint16(eocd+10, true);
  let p = view.getUint32(eocd+16, true);
  const entries = [];
  for(let i=0;i<entryCount;i++){
    if(view.getUint32(p, true) !== 0x02014b50) throw new Error('Повреждён центральный каталог ZIP.');
    const method = view.getUint16(p+10, true);
    const compSize = view.getUint32(p+20, true);
    const nameLen = view.getUint16(p+28, true);
    const extraLen = view.getUint16(p+30, true);
    const commentLen = view.getUint16(p+32, true);
    const localOffset = view.getUint32(p+42, true);
    const name = new TextDecoder().decode(bytes.subarray(p+46, p+46+nameLen));
    entries.push({ name, method, compSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  const out = [];
  for(const e of entries){
    if(view.getUint32(e.localOffset, true) !== 0x04034b50) throw new Error(`Повреждён локальный заголовок ZIP для "${e.name}".`);
    const lNameLen = view.getUint16(e.localOffset+26, true);
    const lExtraLen = view.getUint16(e.localOffset+28, true);
    const dataStart = e.localOffset + 30 + lNameLen + lExtraLen;
    const compData = bytes.subarray(dataStart, dataStart+e.compSize);
    let outBytes;
    if(e.method===0){ outBytes = compData; }
    else if(e.method===8){
      const stream = new Blob([compData]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      outBytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error(`Неподдерживаемый метод сжатия в ZIP (${e.method}) для файла "${e.name}".`);
    }
    out.push({ name: e.name, text: new TextDecoder('utf-8').decode(outBytes) });
  }
  return out;
}

// Экспериментально: расход/показы/клики через асинхронный отчёт Ozon
// (запрос → ожидание готовности → скачивание). Максимум 10 кампаний за
// один запрос и один отчёт одновременно на аккаунт — поэтому активные
// кампании обрабатываются батчами по 10, последовательно. Точный формат
// готового отчёта (JSON/CSV, названия колонок) не подтверждён — сырой
// ответ показывается в журнале, чтобы можно было доработать разбор.
// Разбор CSV-отчёта Performance API (внутри ZIP, один файл на кампанию).
// Формат подтверждён на реальном аккаунте: заголовок начинается с
// "День;sku;...", строки по каждому SKU за день, и итоговая строка
// "Всего;..." в конце файла, которую пропускаем, чтобы не задвоить суммы.
function parsePerfReportCsv(text){
  const lines = text.split(/\r?\n/);
  let headerIdx = -1;
  for(let i=0;i<lines.length;i++){
    if(/^день;sku/i.test(lines[i].trim())){ headerIdx = i; break; }
  }
  if(headerIdx<0) return [];
  const rows = [];
  for(let i=headerIdx+1;i<lines.length;i++){
    const line = lines[i];
    if(!line || !line.trim()) continue;
    const f = line.split(';');
    if(!f[0] || f[0].trim().toLowerCase()==='всего') continue;
    const rawSku = (f[1]||'').trim();
    if(!rawSku) continue;
    rows.push({
      rawSku,
      name: f[2],
      impressions: parseNumber(f[4]),
      clicks: parseNumber(f[5]),
      cpc: parseNumber(f[8]),
      adSpend: parseNumber(f[9]),
      adOrders: parseNumber(f[10]),
      adRevenue: parseNumber(f[11]),
    });
  }
  return rows;
}

async function apiPullCampaignStats(period, dateFrom, dateTo){
  if(!dateFrom || !dateTo){ perfLog('❌ Укажите даты «с» и «по» (поля рядом с кнопками Seller API выше).', true); return; }
  try{
    if(!PERF_CAMPAIGNS_CACHE.length){
      perfLog('Список кампаний ещё не загружен — сначала подтягиваю его…');
      await apiPullCampaignsList(period);
    }
    const active = PERF_CAMPAIGNS_CACHE.filter(c=> c.state==='CAMPAIGN_STATE_RUNNING');
    if(!active.length){ perfLog('⚠️ Нет кампаний со статусом «идёт» — расход считать не по чему.', true); return; }
    if(!Object.keys(SKU_ID_MAP).length){
      perfLog('Сопоставление SKU ещё не загружено — сначала подтягиваю список товаров…');
      await apiPullProducts(period);
    }
    perfLog(`Активных кампаний: ${active.length}. Запрашиваю статистику батчами по 10 — Ozon строит отчёт асинхронно, это может занять несколько минут, не закрывайте вкладку.`);
    const allRows = [];
    const warnings = [];
    for(let i=0;i<active.length;i+=10){
      const batch = active.slice(i,i+10).map(c=>String(c.id));
      const batchNum = Math.floor(i/10)+1;
      perfLog(`Батч ${batchNum}: запрашиваю отчёт по ${batch.length} кампани${batch.length===1?'и':'ям'}…`);
      try{
        const gen = await perfFetch('api/client/statistics', 'POST', {
          campaigns: batch, from: dateFrom+'T00:00:00Z', to: dateTo+'T23:59:59Z', groupBy: 'DATE',
        });
        const uuid = gen && gen.UUID;
        if(!uuid){ perfLog(`❌ Батч ${batchNum}: Ozon не вернул UUID отчёта.`, true); continue; }
        let statusResp = null;
        for(let attempt=1; attempt<=18; attempt++){
          await sleep(5000);
          statusResp = await perfFetch(`api/client/statistics/${uuid}`, 'GET');
          if(statusResp && statusResp.state==='OK') break;
          if(statusResp && /ERROR|FAIL/i.test(statusResp.state||'')) throw new Error('Ozon сообщил об ошибке построения отчёта: ' + statusResp.state);
          perfLog(`  … батч ${batchNum}: отчёт ещё готовится (попытка ${attempt}/18)`);
        }
        if(!statusResp || statusResp.state!=='OK'){ perfLog(`⚠️ Батч ${batchNum}: отчёт не успел подготовиться за отведённое время — попробуйте нажать ещё раз позже.`, true); continue; }
        const link = statusResp.link;
        if(!link){ perfLog(`⚠️ Батч ${batchNum}: Ozon подтвердил готовность, но не дал ссылку на отчёт.`, true); continue; }
        const buf = await perfFetchBinary(link.replace(/^\/+/, ''), 'GET');
        const bytes = new Uint8Array(buf);
        const isZip = bytes.length>=2 && bytes[0]===0x50 && bytes[1]===0x4B; // сигнатура "PK"
        let files;
        if(isZip){
          files = await unzipEntries(buf);
          perfLog(`Батч ${batchNum}: отчёт — ZIP-архив, файлов внутри: ${files.length} (${files.map(f=>f.name).join(', ')}).`);
        } else {
          files = [{ name:'report', text: new TextDecoder('utf-8').decode(bytes) }];
        }
        files.forEach(f=>{
          const numMatch = f.name.match(/^(\d+)_/);
          const campaignId = numMatch ? numMatch[1] : null;
          const known = campaignId ? active.find(c=>String(c.id)===campaignId) : null;
          const campaignName = known ? known.title : (campaignId ? `Кампания ${campaignId}` : f.name);
          const parsed = parsePerfReportCsv(f.text);
          if(!parsed.length){
            perfLog(`⚠️ Батч ${batchNum}, файл «${f.name}»: не удалось распознать формат — сырой текст (первые 500 симв.): ${f.text.slice(0,500)}`, true);
            return;
          }
          parsed.forEach(r=>{
            const mapped = SKU_ID_MAP[r.rawSku];
            if(!mapped && !warnings.some(w=>w.includes(r.rawSku))) warnings.push(`Реклама на несопоставленный SKU: внутренний ID Ozon ${r.rawSku} — показан как есть.`);
            allRows.push({
              campaign: campaignName, sku: mapped||r.rawSku,
              impressions: r.impressions, clicks: r.clicks, cpc: r.cpc,
              adSpend: r.adSpend, adOrders: r.adOrders, adRevenue: r.adRevenue,
            });
          });
          perfLog(`Батч ${batchNum}, «${campaignName}»: строк по SKU — ${parsed.length}.`);
        });
      }catch(err){ perfLog(`❌ Батч ${batchNum}: ${err.message}`, true); }
    }
    if(!allRows.length){ perfLog('⚠️ Не удалось получить ни одной строки статистики.', true); return; }
    pushApiEntry(period, `Реклама из Ozon API (${allRows.length} строк)`, 'advertising', allRows, null, warnings);
    perfLog(`✅ Готово: ${allRows.length} строк по рекламе добавлено в текущий период. Нажмите «Обновить всё» или «Обработать данные», чтобы пересчитать отчёт.`);
  }catch(err){ perfLog('❌ ' + err.message, true); }
}

/* ---------- 15. ИНИЦИАЛИЗАЦИЯ ---------- */

document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('report-date').value = todayStr();
  renderHelp();

  document.querySelectorAll('.tab').forEach(btn=>{
    btn.onclick = ()=> switchTab(btn.dataset.tab);
  });

  function wireDropzone(zoneId, inputId, period){
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    input.onchange = ()=> addFiles(period, input.files);
    const dz = zone.querySelector('.dropzone');
    ['dragenter','dragover'].forEach(evt=> dz.addEventListener(evt, e=>{ e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave','drop'].forEach(evt=> dz.addEventListener(evt, e=>{ e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', e=>{ if(e.dataTransfer.files.length) addFiles(period, e.dataTransfer.files); });
  }
  wireDropzone('zone-current','input-current','current');
  wireDropzone('zone-previous','input-previous','previous');

  // Ozon API
  document.getElementById('api-client-id').value = API_CREDS.clientId||'';
  document.getElementById('api-key').value = API_CREDS.apiKey||'';
  document.getElementById('api-proxy-url').value = API_CREDS.proxyUrl||'';
  document.getElementById('api-date-from').value = todayStr();
  document.getElementById('api-date-to').value = todayStr();
  document.getElementById('perf-client-id').value = PERF_CREDS.clientId||'';
  document.getElementById('perf-client-secret').value = PERF_CREDS.clientSecret||'';
  document.getElementById('btn-perf-save').onclick = ()=>{
    PERF_CREDS = {
      clientId: document.getElementById('perf-client-id').value.trim(),
      clientSecret: document.getElementById('perf-client-secret').value.trim(),
    };
    PERF_TOKEN = null;
    savePerfCreds();
    perfLog('Ключи Performance API сохранены в этом браузере.');
  };
  document.getElementById('btn-perf-test').onclick = testPerfConnection;
  document.getElementById('btn-perf-campaigns').onclick = ()=> apiPullCampaignsList('current');
  document.getElementById('btn-perf-stats').onclick = ()=>{
    const from = document.getElementById('api-date-from').value;
    const to = document.getElementById('api-date-to').value;
    apiPullCampaignStats('current', from, to);
  };
  document.getElementById('btn-api-toggle').onclick = ()=>{
    const body = document.getElementById('api-box-body');
    body.hidden = !body.hidden;
  };
  document.getElementById('btn-api-today').onclick = ()=>{
    const today = todayStr();
    document.getElementById('api-date-from').value = today;
    document.getElementById('api-date-to').value = today;
  };
  document.getElementById('btn-api-save').onclick = ()=>{
    API_CREDS = {
      clientId: document.getElementById('api-client-id').value.trim(),
      apiKey: document.getElementById('api-key').value.trim(),
      proxyUrl: document.getElementById('api-proxy-url').value.trim(),
    };
    saveApiCreds();
    apiLog('Ключи сохранены в этом браузере.');
  };
  document.getElementById('btn-api-test').onclick = testApiConnection;
  document.querySelectorAll('[data-api-pull]').forEach(btn=>{
    btn.onclick = ()=>{
      const period = btn.dataset.period;
      const kind = btn.dataset.apiPull;
      const from = document.getElementById('api-date-from').value;
      const to = document.getElementById('api-date-to').value;
      if(kind==='stocks') apiPullStocks(period);
      else if(kind==='products') apiPullProducts(period);
      else if(kind==='sales') apiPullSales(period, from, to);
      else if(kind==='finance') apiPullFinance(period, from, to);
      else if(kind==='reviews') apiPullReviews(period);
    };
  });
  document.getElementById('btn-api-refresh-all').onclick = async ()=>{
    const btn = document.getElementById('btn-api-refresh-all');
    // «Обновить всё» всегда берёт сегодняшний день, а не то, что случайно
    // осталось в полях «Дата с/по» после точечной догрузки другого периода.
    const today = todayStr();
    document.getElementById('api-date-from').value = today;
    document.getElementById('api-date-to').value = today;
    const from = today, to = today;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Обновляю…';
    document.getElementById('api-status').innerHTML = '';
    try{
      await apiPullStocks('current');
      await sleep(400);
      await apiPullProducts('current');
      await sleep(400);
      await apiPullSales('current', from, to);
      apiLog('Данные обновлены — строю отчёт…');
      process();
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };
  document.getElementById('btn-show-proxy').onclick = async ()=>{
    const pre = document.getElementById('proxy-code');
    if(pre.hidden){
      if(!pre.textContent){
        try{
          const res = await fetch('proxy/cloudflare-worker.js');
          pre.textContent = await res.text();
        }catch(e){ pre.textContent = 'Не удалось загрузить файл. Откройте agent/proxy/cloudflare-worker.js в репозитории.'; }
      }
      pre.hidden = false;
    } else {
      pre.hidden = true;
    }
  };

  document.getElementById('btn-process').onclick = process;
  document.getElementById('btn-templates').onclick = downloadTemplates;
  document.getElementById('btn-download-cost-template').onclick = downloadCostTemplate;
  document.getElementById('btn-clear').onclick = ()=>{
    if(!confirm('Очистить загруженные файлы и текущий отчёт? История решений и настройки сохранятся.')) return;
    queued.current = []; queued.previous = [];
    STATE = { current:null, previous:null, priorities:[], adRecos:[], dateStr: todayStr() };
    renderFileLists();
    document.getElementById('upload-log').innerHTML = '';
    document.getElementById('report-text').hidden = true;
    document.getElementById('report-empty').hidden = false;
    renderSkuTable(); renderFinanceTab(); renderAdsTab(); renderStockTab();
  };

  document.getElementById('btn-copy-report').onclick = ()=>{
    const text = document.getElementById('report-text').textContent;
    if(!text) return;
    navigator.clipboard?.writeText(text).then(()=> alert('Отчёт скопирован.'), ()=> alert('Не удалось скопировать — выделите текст вручную.'));
  };
  document.getElementById('btn-download-report').onclick = ()=>{
    const text = document.getElementById('report-text').textContent;
    if(!text) return;
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ozon-report-${STATE.dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  document.getElementById('btn-settings').onclick = openSettings;
  document.getElementById('btn-settings-save').onclick = ()=>{
    SETTINGS.lowStockDaysDefault = parseNumber(document.getElementById('set-lowstock').value) ?? DEFAULT_THRESHOLDS.lowStockDaysDefault;
    SETTINGS.overstockDaysDefault = parseNumber(document.getElementById('set-overstock').value) ?? DEFAULT_THRESHOLDS.overstockDaysDefault;
    SETTINGS.declineWarnPct = parseNumber(document.getElementById('set-decline-warn').value) ?? DEFAULT_THRESHOLDS.declineWarnPct;
    SETTINGS.declineBadPct = parseNumber(document.getElementById('set-decline-bad').value) ?? DEFAULT_THRESHOLDS.declineBadPct;
    SETTINGS.growthPct = parseNumber(document.getElementById('set-growth').value) ?? DEFAULT_THRESHOLDS.growthPct;
    SETTINGS.drrDegradePp = parseNumber(document.getElementById('set-drr-degrade').value) ?? DEFAULT_THRESHOLDS.drrDegradePp;
    SETTINGS.targetMarginDefault = parseNumber(document.getElementById('set-target-margin').value) ?? DEFAULT_THRESHOLDS.targetMarginDefault;
    SETTINGS.safetyDays = parseNumber(document.getElementById('set-safety-days').value) ?? DEFAULT_THRESHOLDS.safetyDays;
    saveSettings();
    document.getElementById('settings-overlay').hidden = true;
    if(STATE.current) process();
  };
  document.getElementById('btn-settings-reset').onclick = ()=>{
    SETTINGS = Object.assign({}, DEFAULT_THRESHOLDS);
    saveSettings();
    openSettings();
  };
  document.getElementById('settings-overlay').onclick = e=>{ if(e.target.id==='settings-overlay') e.currentTarget.hidden = true; };

  // manual decision modal
  const decisionFields = [
    ['date','Дата','date'], ['target','SKU или кампания','text'], ['metric','Показатель','text'],
    ['before','Значение до','text'], ['change','Изменение','text'], ['after','Значение после (можно позже)','text'],
    ['reason','Причина','text'], ['expectedEffect','Ожидаемый эффект','text'],
  ];
  document.getElementById('btn-add-decision').onclick = ()=>{
    const form = document.getElementById('decision-form');
    form.innerHTML = decisionFields.map(([key,label,type])=>`<label>${label}<input type="${type}" data-field="${key}" ${key==='date'?`value="${STATE.dateStr}"`:''}></label>`).join('');
    document.getElementById('decision-overlay').hidden = false;
  };
  document.getElementById('btn-decision-cancel').onclick = ()=> document.getElementById('decision-overlay').hidden = true;
  document.getElementById('btn-decision-save').onclick = ()=>{
    const rec = {id: uid(), status:'confirmed', source:'manual'};
    document.querySelectorAll('#decision-form [data-field]').forEach(inp=> rec[inp.dataset.field] = inp.value);
    HISTORY.unshift(rec);
    saveHistory();
    document.getElementById('decision-overlay').hidden = true;
    renderHistoryTab();
  };
  document.getElementById('decision-overlay').onclick = e=>{ if(e.target.id==='decision-overlay') e.currentTarget.hidden = true; };

  renderHistoryTab();
});

})();
