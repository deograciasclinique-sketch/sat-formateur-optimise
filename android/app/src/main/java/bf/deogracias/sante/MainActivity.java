package bf.deogracias.sante;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NatifPlugin.class);
        super.onCreate(savedInstanceState);
        // Confidentialité médicale : pas de capture d'écran et écran masqué dans les applications récentes
        // (désactivable par le responsable dans Paramètres → Application Android).
        SharedPreferences p = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
        String defaut = getResources().getBoolean(R.bool.ecran_protege_defaut) ? "1" : "0";
        if (!"0".equals(p.getString("dg-ecran-protege", defaut))) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }
    }
}
