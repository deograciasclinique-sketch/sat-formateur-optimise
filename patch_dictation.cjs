const fs = require('fs');
let code = fs.readFileSync('src/components/TabConsultation.tsx', 'utf8');

if (!code.includes('Mic, MicOff')) {
  code = code.replace(/import \{([^}]+)\} from "lucide-react";/, (match, p1) => {
    return 'import {' + p1 + ', Mic, MicOff} from "lucide-react";';
  });
}

const stateInsert = `
  // Dictation State
  const [isDictating, setIsDictating] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startDictation = (field: "plainte" | "examen" | "diagnostic") => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La saisie vocale n'est pas supportée par votre navigateur (essayez Chrome ou Edge).");
      return;
    }

    if (isDictating === field) {
      recognitionRef.current?.stop();
      setIsDictating(null);
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "fr-FR";
    
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        const textToAppend = finalTranscript.trim();
        if (field === "plainte") {
          setConsPlainte((prev) => {
             const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\\n") ? " " : "";
             return prev + sep + textToAppend;
          });
        } else if (field === "examen") {
          setConsExamen((prev) => {
             const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\\n") ? " " : "";
             return prev + sep + textToAppend;
          });
        } else if (field === "diagnostic") {
          setConsDiagnostic((prev) => {
             const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\\n") ? " " : "";
             return prev + sep + textToAppend;
          });
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsDictating(null);
    };

    recognition.onend = () => {
      setIsDictating((prev) => prev === field ? null : prev);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsDictating(field);
  };
`;

code = code.replace('  const handleSaveConsultation = () => {', stateInsert + '\n  const handleSaveConsultation = () => {');
fs.writeFileSync('src/components/TabConsultation.tsx', code);
