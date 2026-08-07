import Capacitor
import UIKit

/**
 Enables the edge-swipe back gesture in the WebView.

 iOS has no hardware back button, so the swipe from the left edge is the only
 native way back — and `WKWebView` ships with it disabled. Capacitor does not
 turn it on and exposes no configuration option for it, so without this the app
 has no back affordance at all beyond whatever the page itself draws. The
 Android build handles the same requirement through the hardware button in
 `NativeShell`; this is the iOS half of it.

 Subclassing rather than reaching for the web view from `AppDelegate`: the
 bridge creates it, and `viewDidLoad` is the first point at which it reliably
 exists.
 */
class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }
}
