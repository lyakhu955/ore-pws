// Client side remote logging (attivo solo con ?debug=1)
(function(){
  try {
    if(!new URLSearchParams(location.search).has('debug')) return;

    const ENDPOINT = '/api/log';
    const SESSION_ID = Math.random().toString(36).slice(2);
    const QUEUE = [];
    const MAX_BATCH = 10;
    const FLUSH_INTERVAL = 4000;
    let flushTimer = null;
    let sentCount = 0;
    const MAX_PER_SESSION = 400; // limite per non saturare

    function safeSerialize(arg){
      if (arg === undefined) return 'undefined';
      if (arg === null) return 'null';
      const t = typeof arg;
      if (t === 'string') return arg.slice(0,2000);
      if (t === 'number' || t === 'boolean') return String(arg);
      if (t === 'function') return '[function '+(arg.name||'anonymous')+']';
      if (t === 'object') {
        if (arg instanceof Error) {
          return (arg.name+': '+arg.message+'\n'+arg.stack).slice(0,4000);
        }
        try {
          return JSON.stringify(arg, (k,v)=>{
            if (v && typeof v === 'object') {
              if (v instanceof HTMLElement) return '[DOM '+v.tagName+']';
              if (v instanceof Window) return '[Window]';
            }
            return v;
          }).slice(0,2000);
        } catch(e){ return '[Unserializable]'; }
      }
      return String(arg).slice(0,2000);
    }

    function shouldSkip(str){
      return /authorization|bearer|password|token|secret/i.test(str);
    }

    function enqueue(entry){
      if (sentCount >= MAX_PER_SESSION) return;
      if (entry.message && shouldSkip(entry.message)) return;
      QUEUE.push(entry);
      if (QUEUE.length >= MAX_BATCH) flush(); else scheduleFlush();
    }

    function scheduleFlush(){
      if (flushTimer) return;
      flushTimer = setTimeout(()=>flush(), FLUSH_INTERVAL);
    }

    function flush(){
      if (!QUEUE.length) { flushTimer = null; return; }
      const batch = QUEUE.splice(0, QUEUE.length);
      sentCount += batch.length;
      const payload = JSON.stringify({
        session: SESSION_ID,
        ua: navigator.userAgent,
        page: location.href,
        ts: Date.now(),
        logs: batch
      });
      let sent = false;
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([payload], {type:'application/json'});
            sent = navigator.sendBeacon(ENDPOINT, blob);
        } catch(e) {}
      }
      if (!sent) {
        fetch(ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body: payload, keepalive: true }).catch(()=>{});
      }
      flushTimer = null;
    }

    function wrapConsole(fn){
      const original = console[fn];
      console[fn] = function(...args){
        try {
          const msg = args.map(safeSerialize).join(' ');
          enqueue({ level: fn, message: msg, ts: Date.now() });
        } catch(e){}
        original.apply(console, args);
      };
    }

    ['log','info','warn','error'].forEach(wrapConsole);

    window.addEventListener('error', e=>{
      enqueue({ level:'window.error', message: (e.message||'')+' @'+e.filename+':'+e.lineno+':'+e.colno, stack: e.error && e.error.stack || '', ts: Date.now() });
    });

    window.addEventListener('unhandledrejection', e=>{
      enqueue({ level:'promise', message: safeSerialize(e.reason), stack: e.reason && e.reason.stack || '', ts: Date.now() });
    });

    document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('beforeunload', ()=>flush());

    console.log('[RemoteLog] Inizializzato. Sessione:', SESSION_ID);
  } catch(err){
    console.error('Remote log init error', err);
  }
})();
