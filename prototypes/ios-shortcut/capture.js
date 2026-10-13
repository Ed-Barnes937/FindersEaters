// PROTOTYPE - the body of the Shortcut's "Run JavaScript on Webpage" action.
// Paste everything below into that action. It must end by calling completion().
//
// Generic size reduction only: it never looks for a recipe. It drops nodes the
// server extractor never reads (scripts other than JSON-LD, styles, SVG,
// iframes, noscript, templates, comments, non-canonical <link>s, inline style
// attributes). If the page is still over the cap it falls back to a minimal
// document holding only the JSON-LD blocks and the canonical link, or, when
// the page has no JSON-LD, to no HTML at all (the server then fetches the URL).
// An empty html string means "no device HTML".
var CAP = 1000000; // characters; set from the device check (Allow Sharing Large Amounts of Data threshold)
var t0 = Date.now();
var full = document.documentElement.outerHTML.length;
var root = document.documentElement.cloneNode(true);
var drop = root.querySelectorAll(
  'script:not([type="application/ld+json"]),style,svg,iframe,noscript,template,' +
  'link:not([rel="canonical"]),video,audio,canvas,object,embed'
);
for (var i = 0; i < drop.length; i++) drop[i].remove();
var styled = root.querySelectorAll('[style]');
for (var j = 0; j < styled.length; j++) styled[j].removeAttribute('style');
var walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
var comments = [];
while (walker.nextNode()) comments.push(walker.currentNode);
for (var k = 0; k < comments.length; k++) comments[k].remove();
var html = '<!doctype html>' + root.outerHTML;
var trim = 'strip';
if (html.length > CAP) {
  var ld = document.querySelectorAll('script[type="application/ld+json"]');
  if (ld.length === 0) {
    html = '';
    trim = 'none';
  } else {
    var keep = '';
    var c = document.querySelector('link[rel="canonical"]');
    if (c) keep += c.outerHTML;
    for (var m = 0; m < ld.length; m++) keep += ld[m].outerHTML;
    html = '<!doctype html><html><head>' + keep + '</head><body></body></html>';
    trim = 'ldjson';
  }
}
completion({
  url: location.href,
  html: html,
  // Prototype-only diagnostics; the real Shortcut sends url and html only.
  probe: { fullChars: full, sentChars: html.length, trim: trim, ms: Date.now() - t0 }
});
