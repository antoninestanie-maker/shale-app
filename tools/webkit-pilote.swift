// ─────────────────────────────────────────────────────────────────────────────
// Un WKWebView piloté par script : le MOTEUR de l'app installée, pas Chrome.
//
// Pourquoi : Chrome (Puppeteer) ne dit rien de ce que voit Antonin dans
// Shale.app, et le panneau navigateur ne rend ni animation ni survol
// (PIEGES § 11.6). Surtout, un VRAI survol — :hover, transitions, rognage —
// se rejoue ici sans prendre le curseur d'Antonin : la fenêtre est quasi
// transparente et se fait passer pour la fenêtre active (PIEGES § 21.11).
//
//   swiftc -O tools/webkit-pilote.swift -o /tmp/wk
//   /tmp/wk plan.json dossier-de-captures
//
// Le plan est une liste de pas JSON, exécutés dans l'ordre :
//   {"apparence":"dark"|"light"}   {"url":"http://localhost:5199/"}
//   {"js":"…","log":true,"nom":"…"}  {"attendre":ms}
//   {"survol":[x,y]}  {"survolSel":"sélecteur","index":0,"dx":0.5,"dy":0.5}
//   {"clic":[x,y]}    {"capture":"nom","zone":[x,y,l,h]}   (points CSS)
//   {"fond":true}     {"ecran":"nom","zone":[x,y,l,h]}     {"echelle":1}
// À lancer sur le mode démo (PASSATION § 13.2), jamais sur tauri dev.
//
// ⭐ TÉLÉPHONE ET TABLETTE (2026-10-21, lot 4 de l'audit) — deux variables :
//   WK_W=390 WK_H=844 /tmp/wk plan.json dossier      taille de la fenêtre
//   WK_TACTILE=1                                       « au doigt » : réécrit
//     `(pointer: coarse)` / `(hover: none)` en vrai dans `matchMedia` ET dans les
//     feuilles de style, donc `html[data-telephone]`, `.cible-tactile` et les
//     règles au doigt de l'app s'appliquent. Ce n'est PAS du toucher (aucun
//     événement tactile) : la mise en page, la géométrie et le hit-test
//     (`elementFromPoint`) sont ceux de WebKit, les gestes se rejouent en `js`.
//
// ⚠️ DEUX CAPTURES, QUI NE DISENT PAS LA MÊME CHOSE (2026-10-12, PIEGES § 41).
// `capture` (takeSnapshot) redessine la page : elle ne montre PAS un calque
// rééchantillonné par le compositeur — un texte flou à l'écran y sort net.
// `ecran` lit ce que le serveur de fenêtres compose VRAIMENT. Elle exige
// `{"fond":true}` en tête de plan : la fenêtre devient opaque et passe SOUS le
// bureau (invisible pour Antonin, composée quand même). `echelle` force le
// nombre de pixels par point (1 = écran non Retina).
// ─────────────────────────────────────────────────────────────────────────────
import Cocoa
import WebKit

let args = CommandLine.arguments
let plan = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[1]))) as! [[String: Any]]
let out = args[2]
let env = ProcessInfo.processInfo.environment
let W = Double(env["WK_W"] ?? "1360")!, H = Double(env["WK_H"] ?? "880")!

final class Nav: NSObject, WKNavigationDelegate {
  var fini = false
  func webView(_ w: WKWebView, didFinish n: WKNavigation!) { fini = true }
}
func spin(_ ms: Double) { RunLoop.main.run(until: Date().addingTimeInterval(ms / 1000)) }

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let cfg = WKWebViewConfiguration()
cfg.userContentController.addUserScript(WKUserScript(
  source: "try{localStorage.setItem('shale.lang','fr');localStorage.setItem('shale.onboarded','1')}catch(e){}",
  injectionTime: .atDocumentStart, forMainFrameOnly: true))

if env["WK_TACTILE"] == "1" {
  cfg.userContentController.addUserScript(WKUserScript(source: """
  (function(){
    const om = window.matchMedia.bind(window);
    const rw = (q) => q.replace(/\\(pointer:\\s*coarse\\)/g,'(min-width: 0px)').replace(/\\(pointer:\\s*fine\\)/g,'(max-width: 0px)').replace(/\\(hover:\\s*hover\\)/g,'(max-width: 0px)').replace(/\\(hover:\\s*none\\)/g,'(min-width: 0px)');
    window.matchMedia = (q) => om(rw(q));
    const fix = () => { for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules } catch(e) { continue }
      const walk = (rs) => { for (const r of rs) { if (r.media && r.media.mediaText && /pointer|hover:/.test(r.media.mediaText)) { const t = rw(r.media.mediaText); if (t !== r.media.mediaText) r.media.mediaText = t; }
        if (r.cssRules) walk(r.cssRules); } };
      walk(rules); } };
    window.__fixTactile = fix;
    document.addEventListener('DOMContentLoaded', fix); window.addEventListener('load', fix);
    let n = 0; const iv = setInterval(() => { fix(); if (++n > 40) clearInterval(iv) }, 100);
  })();
  """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
}
let rect = NSRect(x: 0, y: 0, width: W, height: H)
final class Fen: NSWindow { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { true }; override var isKeyWindow: Bool { true }; override var isMainWindow: Bool { true } }
let win = Fen(contentRect: rect, styleMask: [.borderless], backing: .buffered, defer: false)
cfg.preferences.inactiveSchedulingPolicy = .none
let wv = WKWebView(frame: rect, configuration: cfg)
let selOcc = NSSelectorFromString("_setWindowOcclusionDetectionEnabled:")
if wv.responds(to: selOcc) {
  typealias F = @convention(c) (AnyObject, Selector, Bool) -> Void
  unsafeBitCast(wv.method(for: selOcc), to: F.self)(wv, selOcc, false)
} else { print("pas de réglage d'occultation") }
let nav = Nav(); wv.navigationDelegate = nav
win.contentView = wv
win.acceptsMouseMovedEvents = true
win.setFrameOrigin(NSPoint(x: 40, y: 40))
win.alphaValue = 0.01
win.orderFrontRegardless()
win.makeKey()

func souris(_ type: NSEvent.EventType, _ x: Double, _ y: Double) {
  let e = NSEvent.mouseEvent(with: type, location: NSPoint(x: x, y: H - y), modifierFlags: [],
    timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: win.windowNumber, context: nil,
    eventNumber: 0, clickCount: 1, pressure: type == .leftMouseDown ? 1 : 0)!
  let simu = NSSelectorFromString("_simulateMouseMove:")
  if type == .mouseMoved && wv.responds(to: simu) {
    wv.perform(simu, with: e)
  } else {
    win.sendEvent(e)
  }
}
func js(_ s: String) -> Any? {
  var fini = false; var res: Any? = nil
  wv.evaluateJavaScript(s) { r, e in res = r ?? (e.map { "ERR \($0)" }); fini = true }
  while !fini { spin(20) }
  return res
}
func shot(_ nom: String, _ clip: [Double]?) {
  var fini = false
  let c = WKSnapshotConfiguration()
  if let k = clip { c.rect = NSRect(x: k[0], y: k[1], width: k[2], height: k[3]) }
  wv.takeSnapshot(with: c) { img, err in
    if let img = img, let t = img.tiffRepresentation, let r = NSBitmapImageRep(data: t),
       let png = r.representation(using: .png, properties: [:]) {
      try? png.write(to: URL(fileURLWithPath: "\(out)/\(nom).png"))
    } else { print("capture ratée", nom, err as Any) }
    fini = true
  }
  while !fini { spin(20) }
}

// `CGWindowListCreateImage` est retirée du SDK mais toujours dans le système :
// on la prend par son nom. Notre propre fenêtre se lit sans autorisation
// d'enregistrement d'écran.
typealias Lire = @convention(c) (CGRect, UInt32, UInt32, UInt32) -> Unmanaged<CGImage>?
func ecran(_ nom: String, _ zone: [Double]?) {
  guard let sym = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CGWindowListCreateImage") else { print("capture écran indisponible"); return }
  // 8 = cette fenêtre seule ; 1 | 8 = sans son ombre, en pleine résolution.
  guard var img = unsafeBitCast(sym, to: Lire.self)(CGRect.null, 8, UInt32(win.windowNumber), 1 | 8)?.takeRetainedValue() else { print("capture écran vide", nom); return }
  let k = Double(img.width) / W
  if let z = zone, let c = img.cropping(to: CGRect(x: z[0] * k, y: z[1] * k, width: z[2] * k, height: z[3] * k)) { img = c }
  if let png = NSBitmapImageRep(cgImage: img).representation(using: .png, properties: [:]) {
    try? png.write(to: URL(fileURLWithPath: "\(out)/\(nom).png"))
  }
}

for pas in plan {
  if pas["fond"] as? Bool == true {
    win.alphaValue = 1
    win.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopWindow)) - 1)
  }
  if let k = pas["echelle"] as? Double {
    let sel = NSSelectorFromString("_setOverrideDeviceScaleFactor:")
    if wv.responds(to: sel) {
      typealias G = @convention(c) (AnyObject, Selector, CGFloat) -> Void
      unsafeBitCast(wv.method(for: sel), to: G.self)(wv, sel, CGFloat(k))
    } else { print("pas d'échelle forcée") }
  }
  if let u = pas["url"] as? String {
    nav.fini = false; wv.load(URLRequest(url: URL(string: u)!))
    while !nav.fini { spin(50) }
  }
  if let a = pas["apparence"] as? String { wv.appearance = NSAppearance(named: a == "dark" ? .darkAqua : .aqua) }
  if let s = pas["js"] as? String { let r = js(s); if pas["log"] as? Bool == true { print(pas["nom"] ?? "", r ?? "nil") } }
  if let p = pas["survol"] as? [Double] { souris(.mouseMoved, p[0], p[1]) }
  if let sel = pas["survolSel"] as? String {
    let i = (pas["index"] as? Int) ?? 0
    let dx = (pas["dx"] as? Double) ?? 0.5, dy = (pas["dy"] as? Double) ?? 0.5
    if let r = js("(()=>{const e=document.querySelectorAll(\(String(reflecting: sel)))[\(i)];if(!e)return null;e.scrollIntoView({block:'nearest'});const b=e.getBoundingClientRect();return [b.x+b.width*\(dx),b.y+b.height*\(dy)]})()") as? [Double] {
      souris(.mouseMoved, r[0] - 30, r[1]); spin(60); souris(.mouseMoved, r[0], r[1])
    } else { print("introuvable", sel) }
  }
  if let p = pas["clic"] as? [Double] { souris(.leftMouseDown, p[0], p[1]); souris(.leftMouseUp, p[0], p[1]) }
  if let ms = pas["attendre"] as? Double { spin(ms) }
  if let n = pas["capture"] as? String { shot(n, pas["zone"] as? [Double]) }
  if let n = pas["ecran"] as? String { ecran(n, pas["zone"] as? [Double]) }
}
print("ok")
