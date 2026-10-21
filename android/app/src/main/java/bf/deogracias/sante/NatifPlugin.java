package bf.deogracias.sante;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;

/**
 * Fonctions natives de l'application DEO GRACIAS Santé (ce qu'un navigateur ne sait pas faire dans une application) :
 *  - impression Android (et « Enregistrer en PDF ») d'un document HTML ou de l'écran ;
 *  - enregistrement des fichiers (PDF, CSV, sauvegardes) dans « Téléchargements », ouverture et partage ;
 *  - dictée vocale (reconnaissance vocale d'Android, en français) ;
 *  - blocage des captures d'écran (confidentialité médicale) ;
 *  - version installée, liens externes, envoi de l'APK par WhatsApp.
 */
@CapacitorPlugin(name = "DGNatif")
public class NatifPlugin extends Plugin {

    private static final String APK_NAME = "DEO-GRACIAS-Sante.apk";
    // garde une référence vers la vue d'impression le temps que l'impression se prépare
    private static WebView vueImpression;

    /* ---------------- version, liens ---------------- */

    @PluginMethod
    public void getVersion(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("version", p.versionName);
            r.put("build", p.versionCode);
        } catch (Exception e) {
            r.put("version", "?");
        }
        call.resolve(r);
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(call.getString("url", "")));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Impossible d'ouvrir le lien : " + e.getMessage());
        }
    }

    /* ---------------- confidentialité ---------------- */

    @PluginMethod
    public void setSecure(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().putString("dg-ecran-protege", on ? "1" : "0").apply();
        final Activity a = getActivity();
        a.runOnUiThread(() -> {
            if (on) a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }

    /* ---------------- impression ---------------- */

    @PluginMethod
    public void printHtml(PluginCall call) {
        final String html = call.getString("html", "");
        final String titre = call.getString("title", "DEO GRACIAS");
        final Activity a = getActivity();
        a.runOnUiThread(() -> {
            try {
                WebView wv = new WebView(a);
                wv.getSettings().setJavaScriptEnabled(false);
                wv.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        imprimer(a, view, titre);
                        call.resolve();
                    }
                });
                vueImpression = wv;
                wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "utf-8", null);
            } catch (Exception e) {
                call.reject("Impression impossible : " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void printPage(PluginCall call) {
        final String titre = call.getString("title", "DEO GRACIAS");
        final Activity a = getActivity();
        a.runOnUiThread(() -> {
            try {
                imprimer(a, getBridge().getWebView(), titre);
                call.resolve();
            } catch (Exception e) {
                call.reject("Impression impossible : " + e.getMessage());
            }
        });
    }

    private static void imprimer(Activity a, WebView vue, String titre) {
        PrintManager pm = (PrintManager) a.getSystemService(Context.PRINT_SERVICE);
        String nom = (titre == null || titre.isEmpty()) ? "DEO GRACIAS" : titre;
        PrintDocumentAdapter adapter = vue.createPrintDocumentAdapter(nom);
        pm.print(nom, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
    }

    /* ---------------- fichiers ---------------- */

    /** Enregistre un fichier dans « Téléchargements / DEO GRACIAS » puis renvoie son adresse. */
    @PluginMethod
    public void saveFile(PluginCall call) {
        String nom = nettoyer(call.getString("name", "document"));
        String mime = call.getString("mime", "application/octet-stream");
        String data = call.getString("base64", "");
        String dossier = nettoyer(call.getString("folder", "DEO GRACIAS"));
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver cr = getContext().getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, nom);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + dossier);
                uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("dossier Téléchargements indisponible");
                try (OutputStream out = cr.openOutputStream(uri)) { out.write(bytes); }
            } else {
                File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), dossier);
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, nom);
                try (OutputStream out = new FileOutputStream(f)) { out.write(bytes); }
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            }
            JSObject r = new JSObject();
            r.put("uri", uri.toString());
            r.put("name", nom);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Enregistrement impossible : " + e.getMessage());
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(Uri.parse(call.getString("uri", "")), call.getString("mime", "*/*"));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Aucune application pour ouvrir ce fichier");
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** Partage un fichier (WhatsApp, e-mail…) depuis le cache de l'application. */
    @PluginMethod
    public void shareFile(PluginCall call) {
        String nom = nettoyer(call.getString("name", "document"));
        try {
            byte[] bytes = Base64.decode(call.getString("base64", ""), Base64.DEFAULT);
            File dir = new File(getContext().getCacheDir(), "partage");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, nom);
            try (OutputStream out = new FileOutputStream(f)) { out.write(bytes); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType(call.getString("mime", "application/octet-stream"));
            i.putExtra(Intent.EXTRA_STREAM, uri);
            String text = call.getString("text", "");
            if (text != null && !text.isEmpty()) i.putExtra(Intent.EXTRA_TEXT, text);
            i.setClipData(ClipData.newRawUri(nom, uri));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent ch = Intent.createChooser(i, "Partager");
            ch.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(ch);
            call.resolve();
        } catch (Exception e) {
            call.reject("Partage impossible : " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        try {
            getActivity().startActivity(Intent.createChooser(i, "Partager"));
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /** Envoie le fichier d'installation de l'application elle-même (fonctionne sans internet). */
    @PluginMethod
    public void shareApk(PluginCall call) {
        try {
            Context ctx = getContext();
            File src = new File(ctx.getApplicationInfo().sourceDir);
            File dir = new File(ctx.getCacheDir(), "partage");
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, APK_NAME);
            copier(src, out);
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", out);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("application/vnd.android.package-archive");
            i.putExtra(Intent.EXTRA_STREAM, uri);
            i.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
            i.setClipData(ClipData.newRawUri(APK_NAME, uri));
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                try {
                    Intent w = new Intent(i);
                    w.setPackage(pkg);
                    getActivity().startActivity(w);
                    call.resolve();
                    return;
                } catch (ActivityNotFoundException ignored) { }
            }
            Intent ch = Intent.createChooser(i, "Envoyer l'application");
            ch.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(ch);
            call.resolve();
        } catch (Exception e) {
            call.reject("Impossible de préparer le fichier : " + e.getMessage());
        }
    }

    /* ---------------- dictée vocale ---------------- */

    @PluginMethod
    public void dictee(PluginCall call) {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("lang", "fr-FR"));
        i.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", "Parlez maintenant…"));
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            startActivityForResult(call, i, "finDictee");
        } catch (ActivityNotFoundException e) {
            call.reject("Reconnaissance vocale absente : installez ou activez l'application Google sur ce téléphone.");
        }
    }

    @ActivityCallback
    private void finDictee(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        String texte = "";
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            ArrayList<String> l = result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (l != null && !l.isEmpty()) texte = l.get(0);
        }
        r.put("text", texte);
        call.resolve(r);
    }

    /* ---------------- utilitaires ---------------- */

    private static String nettoyer(String nom) {
        String n = nom == null ? "document" : nom.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return n.isEmpty() ? "document" : n;
    }

    private static void copier(File src, File dst) throws Exception {
        if (dst.exists() && dst.length() == src.length() && dst.lastModified() >= src.lastModified()) return;
        try (InputStream in = new FileInputStream(src); OutputStream out = new FileOutputStream(dst)) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
    }
}
