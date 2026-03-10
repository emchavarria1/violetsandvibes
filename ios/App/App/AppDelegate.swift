import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Ensure WKWebView does not get automatic safe-area content insets.
        DispatchQueue.main.async { [weak self] in
            self?.normalizeWebViewInsets()
        }
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Re-apply after lifecycle transitions where iOS can reintroduce insets.
        normalizeWebViewInsets()
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    private func normalizeWebViewInsets() {
        guard let root = window?.rootViewController,
              let bridgeVC = findBridgeViewController(from: root),
              let webView = bridgeVC.webView else {
            return
        }

        bridgeVC.additionalSafeAreaInsets = .zero
        let scrollView = webView.scrollView
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.contentInset = .zero
        scrollView.scrollIndicatorInsets = .zero
    }

    private func findBridgeViewController(from vc: UIViewController) -> CAPBridgeViewController? {
        if let bridgeVC = vc as? CAPBridgeViewController {
            return bridgeVC
        }

        for child in vc.children {
            if let bridgeVC = findBridgeViewController(from: child) {
                return bridgeVC
            }
        }

        if let presented = vc.presentedViewController {
            return findBridgeViewController(from: presented)
        }

        if let nav = vc as? UINavigationController, let visible = nav.visibleViewController {
            return findBridgeViewController(from: visible)
        }

        if let tab = vc as? UITabBarController, let selected = tab.selectedViewController {
            return findBridgeViewController(from: selected)
        }

        return nil
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
