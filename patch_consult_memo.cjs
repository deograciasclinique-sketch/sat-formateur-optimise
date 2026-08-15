const fs = require('fs');
let code = fs.readFileSync('src/components/TabConsultation.tsx', 'utf8');

const anchor = '  const handleSaveConsultation = () => {';

const memoStr = `  const knownPatientProfiles = useMemo(() => {
    const map = new Map<string, Consultation>();
    // Sort consultations to have the most recent ones first
    const sortedCons = [...consultations].sort((a, b) => b.id.localeCompare(a.id));
    sortedCons.forEach(c => {
      const name = c.patient.trim();
      if (name && !map.has(name)) {
        map.set(name, c);
      }
    });
    return Array.from(map.values());
  }, [consultations]);

  const handleContinuerDossier = (c: Consultation) => {
    setConsPatient(c.patient);
    setConsAge(c.age ? c.age.toString() : "");
    setConsSexe(c.sexe);
    setConsContact(c.contact || "");
    setConsProfession(c.profession || "");
    setConsFemmeEnceinte(c.femmeEnceinte || false);
    // Focus the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

`;

code = code.replace(anchor, memoStr + anchor);
fs.writeFileSync('src/components/TabConsultation.tsx', code);
