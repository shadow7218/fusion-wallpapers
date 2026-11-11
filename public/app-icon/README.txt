FUSION - app icon / loading-screen logo folder
==============================================
This folder is ONLY for the logo people see when they install Fusion to the
home screen: the home-screen icon and the loading (splash) screen.
The logo inside the website itself (public/logo.webp) is NOT touched.

To change it later, replace ALL of these files (keep the names), then raise the
number in public/manifest.json (?v=2 -> ?v=3) so phones notice the change:

  icon-192.png            192 x 192   logo on a pure black square   (loading screen)
  icon-512.png            512 x 512   same, bigger                  (loading screen)
  icon-maskable-512.png   512 x 512   full square, logo kept small in the middle;
                                      this is the HOME-SCREEN icon. Android cuts it into
                                      the shape the phone uses (circle, squircle...)
  apple-touch-icon.png    180 x 180   iPhone icon, no transparency

Tip: the home-screen icon uses the maskable file. If you only change icon-192.png
you will not see any difference.
