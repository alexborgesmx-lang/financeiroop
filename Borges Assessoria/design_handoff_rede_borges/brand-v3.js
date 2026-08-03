/* ============================================================
   REDE BORGES — Linha de Confiança
   Nós ligados por um fio: a rede de indicações que sustenta a marca.
   Uso: <svg class="thread" data-thread data-n="8" data-sw="2"></svg>
   Cada <svg> com [data-thread] é desenhado no viewBox informado
   (width/height do próprio SVG). A cor vem de currentColor (color:).
   ============================================================ */
(function(){
  function draw(svg){
    var W = +svg.getAttribute('data-w') || svg.viewBox.baseVal.width || 420;
    var H = +svg.getAttribute('data-h') || svg.viewBox.baseVal.height || 60;
    var n = +svg.getAttribute('data-n') || 7;
    var sw = +svg.getAttribute('data-sw') || 2;
    var amp = (svg.hasAttribute('data-amp') ? +svg.getAttribute('data-amp') : 0.22);
    var midY = H/2, pts = [];
    for(var i=0;i<n;i++){
      var x = 16 + i*((W-32)/(n-1));
      var y = midY + Math.sin(i*1.1)*(H*amp);
      pts.push([x,y]);
    }
    var d = 'M '+pts[0][0]+' '+pts[0][1];
    for(var j=1;j<n;j++){
      var px=pts[j-1], cx=pts[j], mx=(px[0]+cx[0])/2;
      d += ' C '+mx+' '+px[1]+' '+mx+' '+cx[1]+' '+cx[0]+' '+cx[1];
    }
    var nodes='';
    pts.forEach(function(p,i){
      var r = (i===Math.floor(n/2))?5:3.4;
      nodes += '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+r+'" fill="currentColor"/>';
    });
    if(!svg.getAttribute('viewBox')) svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.innerHTML = '<path d="'+d+'" fill="none" stroke="currentColor" stroke-width="'+sw+'" stroke-linecap="round"/>'+nodes;
  }
  function init(){
    document.querySelectorAll('svg[data-thread]').forEach(draw);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
