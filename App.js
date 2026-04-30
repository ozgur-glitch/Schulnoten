import React, { useState, useEffect } from 'react';
import { 
  Text, View, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Modal, SafeAreaView, FlatList, StatusBar, Dimensions, Linking, Share, Alert
} from 'react-native'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PREDEFINED_SUBJECTS = {
  'Englisch': '#5C6BC0', 
  'Mathe': '#2979FF',    
  'Deutsch': '#FF5252',  
  'Geo': '#00B8D4',      
  'Bio': '#43A047',      
  'Ethik': '#FF9100',    
  'Kunst': '#AB47BC',    
  'Sport': '#FDD835',    
  'Musik': '#F06292',    
  'Medien': '#78909C',   
  'KL-Stunde': '#455A64', 
  'MGirls': '#EC407A',
}; 

const COLOR_PALETTE = [
  '#FF5252', '#FF9100', '#FDD835', '#43A047', '#00B8D4', '#2979FF', '#5C6BC0', '#AB47BC', '#F06292', '#455A64'
];

const THEMES = {
  light: {
    primary: '#2979FF',     
    secondary: '#1C2E4A',   
    background: '#F8FAFC',  
    card: '#FFFFFF',
    textMain: '#1E293B',
    textSecondary: '#64748B',
    white: '#FFFFFF',
    success: '#00C853',
    danger: '#FF1744',
    warning: '#FFAB00',
    accent: '#6366F1',
    input: '#F1F5F9',
    border: '#F1F5F9'
  },
  dark: {
    primary: '#3B82F6',     
    secondary: '#0F172A',   
    background: '#020617',  
    card: '#1E293B',
    textMain: '#F1F5F9',
    textSecondary: '#94A3B8',
    white: '#FFFFFF',
    success: '#10B981',
    danger: '#EF4444',
    warning: '#F59E0B',
    accent: '#818CF8',
    input: '#0F172A',
    border: '#334155'
  }
};

let THEME = THEMES.light;

const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// --- Hilfsfunktionen ---
const getPureNumber = (gradeStr) => {
  const num = parseFloat(gradeStr.toString().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}; 

const getMostFrequentSymbol = (gradesList) => {
  if (gradesList.length === 0) return "";
  let counts = { plus: 0, minus: 0 };
  gradesList.forEach(g => {
    if (g.displayGrade?.includes('+')) counts.plus++;
    else if (g.displayGrade?.includes('-')) counts.minus++;
  });
  return counts.plus > counts.minus ? "+" : (counts.minus > counts.plus ? "-" : ""); 
}; 

const parseDate = (dateStr) => {
  if (!dateStr) return 0;
  const [day, month, year] = dateStr.split('.').map(Number);
  return new Date(year, month - 1, day).getTime();
}; 

const getRawAverageForMonths = (gradesList, months) => {
  const now = Date.now();
  const limit = now - (months * 30 * 24 * 60 * 60 * 1000);
  const filtered = gradesList.filter(g => parseDate(g.date) >= limit);
  if (filtered.length === 0) return null;
  const sum = filtered.reduce((a, c) => a + getPureNumber(c.displayGrade), 0);
  return sum / filtered.length;
};

const calculateTrends = (gradesList, fullLabel = false) => {
  const avg3 = getRawAverageForMonths(gradesList, 3);
  const avg6 = getRawAverageForMonths(gradesList, 6);
  const avg12 = getRawAverageForMonths(gradesList, 12);

  const calcTrend = (newVal, oldVal, label, timeSpan) => {
    if (newVal === null) return null;
    let status = "Stabil";
    let color = THEME.warning;
    if (oldVal !== null) {
        const diff = newVal - oldVal;
        if (diff < -0.1) { status = "Besser"; color = THEME.success; }
        else if (diff > 0.1) { status = "Schlechter"; color = THEME.danger; }
    }
    const limit = Date.now() - (timeSpan * 30 * 24 * 60 * 60 * 1000);
    const relevantGrades = gradesList.filter(g => parseDate(g.date) >= limit);
    const symbol = getMostFrequentSymbol(relevantGrades);
    const numericPart = newVal.toFixed(1).replace('.', ',');
    return { label, text: status, color, val: numericPart, symbol: symbol };
  };

  const l3 = fullLabel ? "3 Monate" : "3m";
  const l6 = fullLabel ? "6 Monate" : "6m";
  const l12 = fullLabel ? "12 Monate" : "12m";

  return [
    calcTrend(avg3, avg6, l3, 3),
    calcTrend(avg6, avg12, l6, 6),
    calcTrend(avg12, null, l12, 12)
  ].filter(t => t !== null);
};

export default function App() {
  const [grades, setGrades] = useState([]);
  const [timetable, setTimetable] = useState({});
  const [isLoaded, setIsLoaded] = useState(false); 
  const [isDark, setIsDark] = useState(false);

  THEME = isDark ? THEMES.dark : THEMES.light;

  const [activeTab, setActiveTab] = useState('notes'); 
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('Mathe');
  const [gradeInput, setGradeInput] = useState(''); 
  const [customSubject, setCustomSubject] = useState('');
  const [customSubjectColor, setCustomSubjectColor] = useState(COLOR_PALETTE[0]);
  const [dateInput, setDateInput] = useState(''); 

  const [hwModalVisible, setHwModalVisible] = useState(false);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null); 
  const [hwInput, setHwInput] = useState('');
  const [examDateInput, setExamDateInput] = useState('');
  const [manualSubjectName, setManualSubjectName] = useState('');
  const [manualSubjectColor, setManualSubjectColor] = useState(COLOR_PALETTE[0]);
  const [importText, setImportText] = useState('');

  // Initiales Laden
  useEffect(() => {
    const load = async () => {
      try {
        const g = await AsyncStorage.getItem('grades_data');
        const t = await AsyncStorage.getItem('tt_data');
        const d = await AsyncStorage.getItem('dark_mode');
        if (g) setGrades(JSON.parse(g));
        if (t) setTimetable(JSON.parse(t));
        if (d) setIsDark(JSON.parse(d));
      } catch (e) { console.log("Fehler beim Laden", e); }
      setIsLoaded(true);
    };
    load();
  }, []);

  // Speichern nur wenn Laden abgeschlossen ist
  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem('grades_data', JSON.stringify(grades));
    }
  }, [grades, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem('tt_data', JSON.stringify(timetable));
    }
  }, [timetable, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      AsyncStorage.setItem('dark_mode', JSON.stringify(isDark));
    }
  }, [isDark, isLoaded]);

  const handleExport = async () => {
    const data = JSON.stringify({ grades, timetable });
    try { await Share.share({ message: data }); } catch (e) { Alert.alert("Fehler", "Export fehlgeschlagen"); }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (parsed.grades) setGrades(parsed.grades);
      if (parsed.timetable) setTimetable(parsed.timetable);
      Alert.alert("Erfolg", "Daten wurden importiert!");
      setImportText('');
    } catch (e) { Alert.alert("Fehler", "Ungültiger Code"); }
  };

  const formatInputDate = (text) => {
    let cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2)}`;
    if (cleaned.length > 4) formatted = `${cleaned.slice(0, 2)}.${cleaned.slice(2, 4)}.${cleaned.slice(4, 8)}`;
    return formatted;
  }; 

  const saveGrade = () => {
    if (!gradeInput || !dateInput) return;
    const isCustom = customSubject.trim() !== '';
    const finalSubjectName = isCustom ? customSubject : selectedSubject;
    const finalColor = isCustom ? customSubjectColor : PREDEFINED_SUBJECTS[selectedSubject];
    if (editingId) {
      setGrades(grades.map(g => g.id === editingId ? { ...g, subject: finalSubjectName, displayGrade: gradeInput, date: dateInput, color: finalColor } : g));
    } else {
      setGrades([{ id: Date.now().toString(), subject: finalSubjectName, displayGrade: gradeInput, date: dateInput, color: finalColor }, ...grades]);
    }
    closeModal();
  }; 

  const deleteGrade = () => {
    if (editingId) {
      Alert.alert(
        "Note löschen",
        "Möchtest du diese Note wirklich dauerhaft entfernen?",
        [
          { text: "Abbrechen", style: "cancel" },
          { 
            text: "Löschen", 
            style: "destructive", 
            onPress: () => {
              setGrades(grades.filter(g => g.id !== editingId));
              closeModal();
            } 
          }
        ]
      );
    }
  };

  const closeModal = () => { setModalVisible(false); setEditingId(null); setGradeInput(''); setCustomSubject(''); setDateInput(''); }; 

  const handleShortPress = (dIdx, hour) => {
    const slotKey = `${dIdx}-${hour}`;
    const existing = timetable[slotKey];
    setActiveSlot({dayIdx: dIdx, hour});
    setHwInput(existing?.homework || '');
    setExamDateInput(existing?.examDate || '');
    setHwModalVisible(true);
  };

  const handleLongPress = (dIdx, hour) => {
    setActiveSlot({dayIdx: dIdx, hour});
    setSubjectModalVisible(true);
  };

  const saveHwData = () => {
    const slotKey = `${activeSlot.dayIdx}-${activeSlot.hour}`;
    const current = timetable[slotKey] || { name: '-', color: '#CBD5E1' };
    setTimetable({
      ...timetable,
      [slotKey]: { ...current, homework: hwInput, examDate: examDateInput }
    });
    setHwModalVisible(false);
  };

  const saveSubjectData = (subj, color) => {
    const slotKey = `${activeSlot.dayIdx}-${activeSlot.hour}`;
    if (subj === null) {
      const newTT = {...timetable};
      delete newTT[slotKey];
      setTimetable(newTT);
    } else {
      const current = timetable[slotKey] || {};
      setTimetable({
        ...timetable,
        [slotKey]: { ...current, name: subj, color: color }
      });
    }
    setSubjectModalVisible(false);
    setManualSubjectName('');
  };

  const getSubjectStats = () => {
    const stats = {};
    grades.forEach(g => {
      if (!stats[g.subject]) stats[g.subject] = { sum: 0, count: 0, color: g.color, raw: [] };
      stats[g.subject].sum += getPureNumber(g.displayGrade);
      stats[g.subject].count += 1;
      stats[g.subject].raw.push(g);
    });
    return Object.keys(stats).map(name => {
      const rawAvg = stats[name].sum / stats[name].count;
      return { 
        name, 
        avg: rawAvg.toFixed(1).replace('.', ','), 
        rawAvg: rawAvg, 
        symbol: getMostFrequentSymbol(stats[name].raw), 
        color: stats[name].color, 
        trends: calculateTrends(stats[name].raw, false) 
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  };

  const getNextExamCountdown = () => {
    const exams = [];
    Object.values(timetable).forEach(slot => {
      if (slot.examDate) {
        const time = parseDate(slot.examDate);
        if (time >= new Date().setHours(0,0,0,0)) {
          exams.push({ name: slot.name, time, date: slot.examDate });
        }
      }
    });
    if (exams.length === 0) return null;
    const next = exams.sort((a,b) => a.time - b.time)[0];
    const diffDays = Math.ceil((next.time - Date.now()) / (1000 * 60 * 60 * 24));
    return { name: next.name, days: diffDays, date: next.date };
  };

  const getHolidayCountdown = () => {
    const holidayDate = new Date(2026, 6, 6).getTime(); 
    const diff = holidayDate - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : null;
  };

  const musterLinks = [
    { title: 'Vertretungsplan', desc: 'Aktuelle Ausfälle & Änderungen', url: 'https://www.musterschule.de/UNTIS/Vertretungsplan/show.php?plan=H_Schueler_heute', icon: '📋' },
    { title: 'Schulportal Hessen', desc: 'Anmeldung, Login', url: 'https://login.schulportal.hessen.de/?url=aHR0cHM6Ly9jb25uZWN0LnNjaHVscG9ydGFsLmhlc3Nlbi5kZS8=&skin=sp&i=5115', icon: '🔐' },
    { title: 'Infos Musterschule', desc: 'Allgemeine Schulnachrichten', url: 'https://infos.musterschule.de/', icon: '📰' },
    { title: 'Bärenstark Schule', desc: 'Essensbestellung Mensa', url: 'https://baerenstark-schule.de/mobil/#/login', icon: '🐻' },
  ];

  const dynamicStyles = StyleSheet.create({
    container: { backgroundColor: THEME.background },
    navHeaderFixed: { backgroundColor: THEME.secondary },
    navTabText: { color: isDark ? '#94A3B8' : '#94A3B8' },
    navTabTextActive: { color: THEME.white },
    subHeader: { color: THEME.textSecondary },
    linkCard: { backgroundColor: THEME.card },
    linkIconContainer: { backgroundColor: isDark ? THEME.input : '#F1F5F9' },
    linkTitle: { color: THEME.textMain },
    linkDesc: { color: THEME.textSecondary },
    arrowIcon: { color: THEME.primary },
    examHeroBadgeValue: { color: THEME.danger },
    examHeroBadgeLabel: { color: THEME.danger },
    ttTitleCompact: { color: THEME.secondary },
    gridCardFull: { backgroundColor: THEME.card },
    gridRowFull: { borderBottomColor: THEME.border },
    gridRow: { borderBottomColor: THEME.border },
    gridSideHeaderCellSmall: { backgroundColor: isDark ? THEME.secondary : '#F8FAFC', borderRightColor: THEME.border },
    gridDayHeaderCellSmall: { backgroundColor: isDark ? THEME.secondary : '#F8FAFC', borderRightColor: THEME.border },
    gridHeaderTextSmall: { color: isDark ? THEME.textMain : THEME.secondary },
    gridSideCellSmall: { backgroundColor: isDark ? THEME.secondary : '#F8FAFC', borderRightColor: THEME.border },
    gridSideTextSmall: { color: THEME.textSecondary },
    gridCellFull: { borderRightColor: THEME.border },
    modalContent: { backgroundColor: THEME.card },
    modalIndicator: { backgroundColor: THEME.border },
    modalTitle: { color: isDark ? THEME.textMain : THEME.secondary },
    manualSubjectSection: { backgroundColor: THEME.input },
    manualInput: { backgroundColor: THEME.card, color: THEME.textMain },
    inputSingle: { backgroundColor: THEME.input, color: THEME.textMain },
    sectionHeader: { color: isDark ? THEME.textMain : THEME.secondary },
    averageCard: { backgroundColor: THEME.card },
    averageValue: { color: THEME.primary },
    subjectStatContainer: { backgroundColor: THEME.card },
    subjectStatName: { color: THEME.textMain },
    subjectStatAvgNumber: { color: THEME.textMain },
    subjectStatSymbol: { color: THEME.textMain },
    listTitle: { color: THEME.textMain },
    gradeCard: { backgroundColor: THEME.card },
    dateText: { color: THEME.textSecondary },
    gradeContainer: { backgroundColor: THEME.input },
    gradeValueText: { color: THEME.textMain },
    compactLabel: { color: THEME.textSecondary },
    chipSmall: { backgroundColor: THEME.input },
    chipTextSmall: { color: THEME.textMain },
    compactSectionCustom: { backgroundColor: isDark ? THEME.secondary : '#F8FAFC', borderColor: THEME.border },
    manualInputCompact: { backgroundColor: THEME.card, color: THEME.textMain },
    subjectText: { color: THEME.textMain }
  });

  return (
    <SafeAreaView style={[styles.container, dynamicStyles.container]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={[styles.navHeaderFixed, dynamicStyles.navHeaderFixed]}>
        {['notes', 'stats', 'timetable', 'pattern', 'backup'].map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.navTabFixed, activeTab === tab && styles.navTabActive]} 
            onPress={() => setActiveTab(tab)}
          >
            <Text style={styles.navIcon}>{tab === 'notes' ? '📝' : tab === 'stats' ? '📊' : tab === 'timetable' ? '📅' : tab === 'pattern' ? '🏫' : '💾'}</Text>
            <Text style={[styles.navTabText, dynamicStyles.navTabText, activeTab === tab && dynamicStyles.navTabTextActive]} numberOfLines={1}>
              {tab === 'notes' ? 'Noten' : tab === 'stats' ? 'Statistik' : tab === 'timetable' ? 'Plan' : tab === 'pattern' ? 'Muster' : 'Backup'}
            </Text>
          </TouchableOpacity>
        ))}
      </View> 

      {/* STATS TAB */}
      {activeTab === 'stats' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.statsScrollContent}>
          <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Gesamt-Statistik</Text>
          <View style={[styles.averageCard, dynamicStyles.averageCard]}>
            <Text style={[styles.averageValue, dynamicStyles.averageValue]}>{grades.length > 0 ? `${(grades.reduce((a,c) => a + getPureNumber(c.displayGrade), 0) / grades.length).toFixed(1).replace('.', ',')}${getMostFrequentSymbol(grades)}` : "—"}</Text>
            <View style={styles.trendRowFull}>
              {calculateTrends(grades, true).map((t, idx) => (
                <View key={idx} style={[styles.trendBox, { backgroundColor: t.color }]}>
                  <Text style={styles.trendBoxValue}>{t.val}{t.symbol}</Text>
                  <Text style={styles.trendBoxStatus}>{t.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Einzelne Fächer</Text>
          {getSubjectStats().map((item, idx) => (
            <View key={idx} style={[styles.subjectStatContainer, dynamicStyles.subjectStatContainer]}>
              <View style={styles.subjectStatRow}>
                <View style={styles.subjectLeftPart}>
                    <View style={[styles.subjectDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.subjectStatName, dynamicStyles.subjectStatName]} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={styles.subjectRightPart}>
                    <Text style={[styles.subjectStatAvgNumber, dynamicStyles.subjectStatAvgNumber]}>{item.avg}</Text>
                    <View style={styles.symbolPlaceholder}>
                        <Text style={[styles.subjectStatSymbol, dynamicStyles.subjectStatSymbol]}>{item.symbol}</Text>
                    </View>
                </View>
              </View>
              <View style={styles.subjectTrendRow}>
                {item.trends.map((t, tIdx) => (
                    <View key={tIdx} style={[styles.miniTrendBox, { backgroundColor: t.color }]}>
                        <View style={styles.miniTrendContent}>
                          <Text style={styles.miniTrendLabel}>{t.label}: </Text>
                          <Text style={styles.miniTrendVal}>{t.val}</Text>
                          <View style={styles.miniSymbolPlaceholder}>
                             <Text style={styles.miniTrendVal}>{t.symbol}</Text>
                          </View>
                        </View>
                    </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* PATTERN TAB */}
      {activeTab === 'pattern' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={{ padding: 20 }}>
          <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Schul-Links</Text>
          <Text style={[styles.subHeader, dynamicStyles.subHeader]}>Alle wichtigen Portale auf einen Blick.</Text>
          {musterLinks.map((link, idx) => (
            <TouchableOpacity key={idx} style={[styles.linkCard, dynamicStyles.linkCard]} onPress={() => Linking.openURL(link.url)} activeOpacity={0.7}>
              <View style={[styles.linkIconContainer, dynamicStyles.linkIconContainer]}><Text style={{ fontSize: 24 }}>{link.icon}</Text></View>
              <View style={styles.linkTextContainer}>
                <Text style={[styles.linkTitle, dynamicStyles.linkTitle]}>{link.title}</Text>
                <Text style={[styles.linkDesc, dynamicStyles.linkDesc]}>{link.desc}</Text>
              </View>
              <Text style={[styles.arrowIcon, dynamicStyles.arrowIcon]}>→</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader, { marginTop: 30 }]}>👨‍💻 Über die App</Text>
          <View style={[styles.linkCard, dynamicStyles.linkCard, { flexDirection: 'column', alignItems: 'flex-start' }]}>
            <Text style={[styles.linkDesc, dynamicStyles.linkDesc, { lineHeight: 20 }]}>
              Diese App wurde entwickelt von Özgür Cetin.{"\n"}
              Ziel ist es, Schülern eine einfache und moderne Organisation ihrer Noten und ihres Stundenplans zu ermöglichen.{"\n"}
              Kontakt: ozgur.cetin@web.de{"\n"}
              © 2026
            </Text>
          </View>
        </ScrollView>
      )}

      {/* BACKUP TAB */}
      {activeTab === 'backup' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={{ padding: 20 }}>
          <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Erscheinungsbild</Text>
          <TouchableOpacity 
            style={[styles.saveBtn, {marginBottom: 30, backgroundColor: isDark ? THEMES.light.primary : THEMES.dark.secondary}]} 
            onPress={() => setIsDark(!isDark)}
          >
            <Text style={styles.saveBtnText}>{isDark ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Sicherung</Text>
          <Text style={[styles.subHeader, dynamicStyles.subHeader]}>Exportiere deine Daten oder stelle sie wieder her.</Text>
          <TouchableOpacity style={[styles.saveBtn, {backgroundColor: THEME.primary}]} onPress={handleExport}>
            <Text style={styles.saveBtnText}>Exportieren / Teilen</Text>
          </TouchableOpacity>
          <TextInput 
            style={[styles.inputSingle, dynamicStyles.inputSingle, {marginTop: 25, height: 100, textAlignVertical: 'top'}]} 
            multiline 
            placeholder="Code hier einfügen zum Importieren..." 
            placeholderTextColor={THEME.textSecondary}
            value={importText} 
            onChangeText={setImportText} 
          />
          <TouchableOpacity style={[styles.saveBtn, {backgroundColor: THEME.success, marginTop: 10}]} onPress={handleImport}>
            <Text style={styles.saveBtnText}>Importieren</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* TIMETABLE TAB */}
      {activeTab === 'timetable' && (
        <View style={styles.ttContainer}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
            {getNextExamCountdown() && (
              <View style={[styles.examHeroCard, { flex: 1, marginBottom: 0, backgroundColor: THEME.danger }]}>
                  <Text style={styles.examHeroTitle}>Nächste Arbeit</Text>
                  <View style={styles.examHeroContent}>
                      <Text style={styles.examHeroSubject} numberOfLines={1}>{getNextExamCountdown().name}</Text>
                      <View style={styles.examHeroBadge}>
                          <Text style={[styles.examHeroBadgeValue, dynamicStyles.examHeroBadgeValue]}>{getNextExamCountdown().days}</Text>
                          <Text style={[styles.examHeroBadgeLabel, dynamicStyles.examHeroBadgeLabel]}>Tage</Text>
                      </View>
                  </View>
              </View>
            )}
            
            {getHolidayCountdown() && (
              <View style={[styles.examHeroCard, { flex: 1, marginBottom: 0, backgroundColor: THEME.success }]}>
                  <Text style={styles.examHeroTitle}>Ferien-Countdown</Text>
                  <View style={styles.examHeroContent}>
                      <Text style={styles.examHeroSubject} numberOfLines={1}>Ferien</Text>
                      <View style={styles.examHeroBadge}>
                          <Text style={[styles.examHeroBadgeValue, { color: THEME.success }]}>{getHolidayCountdown()}</Text>
                          <Text style={[styles.examHeroBadgeLabel, { color: THEME.success }]}>Tage</Text>
                      </View>
                  </View>
              </View>
            )}
          </View>

          {!getNextExamCountdown() && !getHolidayCountdown() && (
             <Text style={[styles.ttTitleCompact, dynamicStyles.ttTitleCompact]}>Wochenplan</Text>
          )}

          <View style={[styles.gridCardFull, dynamicStyles.gridCardFull]}>
            <View style={[styles.gridRow, dynamicStyles.gridRow]}>
              <View style={[styles.gridSideHeaderCellSmall, dynamicStyles.gridSideHeaderCellSmall]}><Text style={[styles.gridHeaderTextSmall, dynamicStyles.gridHeaderTextSmall]}>Std.</Text></View>
              {DAYS_SHORT.map(day => (
                <View key={day} style={[styles.gridDayHeaderCellSmall, dynamicStyles.gridDayHeaderCellSmall]}><Text style={[styles.gridHeaderTextSmall, dynamicStyles.gridHeaderTextSmall]}>{day}</Text></View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {HOURS.map(hour => (
                <View key={hour} style={[styles.gridRowFull, dynamicStyles.gridRowFull]}>
                  <View style={[styles.gridSideCellSmall, dynamicStyles.gridSideCellSmall]}><Text style={[styles.gridSideTextSmall, dynamicStyles.gridSideTextSmall]}>{hour}.</Text></View>
                  {DAYS_SHORT.map((day, dIdx) => {
                    const subjectData = timetable[`${dIdx}-${hour}`];
                    return (
                      <TouchableOpacity 
                        key={dIdx} 
                        style={[styles.gridCellFull, dynamicStyles.gridCellFull, subjectData && { backgroundColor: subjectData.color }]}
                        onPress={() => handleShortPress(dIdx, hour)}
                        onLongPress={() => handleLongPress(dIdx, hour)}
                        delayLongPress={300}
                      >
                        <Text style={[styles.gridCellTextSmall, subjectData && { color: '#fff' }]} adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1}>
                          {subjectData ? subjectData.name : '-'}
                        </Text>
                        <View style={styles.iconIndicatorRowSmall}>
                          {subjectData?.homework ? <Text style={styles.miniIconSmall}>📝</Text> : null}
                          {subjectData?.examDate ? <Text style={styles.miniIconSmall}>📅</Text> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* NOTES TAB */}
      {activeTab === 'notes' && (
        <View style={{ flex: 1 }}>
          <View style={styles.listHeader}>
            <Text style={[styles.listTitle, dynamicStyles.listTitle]}>Deine Noten</Text>
            <TouchableOpacity style={[styles.addButton, {backgroundColor: THEME.primary}]} onPress={() => setModalVisible(true)}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
          </View>
          <FlatList data={[...grades].sort((a,b) => parseDate(b.date) - parseDate(a.date))} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} renderItem={({ item }) => (
            <View style={[styles.gradeCard, dynamicStyles.gradeCard]}>
              <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { setEditingId(item.id); setGradeInput(item.displayGrade); setDateInput(item.date); setModalVisible(true); }}>
                <Text style={[styles.subjectText, dynamicStyles.subjectText]}>{item.subject}</Text>
                <Text style={[styles.dateText, dynamicStyles.dateText]}>{item.date}</Text> 
              </TouchableOpacity>
              <View style={[styles.gradeContainer, dynamicStyles.gradeContainer]}><Text style={[styles.gradeValueText, dynamicStyles.gradeValueText]}>{item.displayGrade}</Text></View>
            </View>
          )} />
        </View>
      )}

      {/* MODALS */}
      <Modal animationType="fade" transparent={true} visible={hwModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent, { paddingBottom: 30 }]}>
            <View style={[styles.modalIndicator, dynamicStyles.modalIndicator]} />
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Aufgaben & Termine</Text>
            <View style={styles.inputRow}>
              <TextInput style={[styles.inputSingle, dynamicStyles.inputSingle, {flex: 1, marginBottom: 0}]} placeholder="Hausaufgabe..." placeholderTextColor={THEME.textSecondary} value={hwInput} onChangeText={setHwInput} />
              <TouchableOpacity onPress={() => setHwInput('')} style={styles.deleteIconBtn}><Text>🗑️</Text></TouchableOpacity>
            </View>
            <View style={[styles.inputRow, {marginTop: 15}]}>
              <TextInput 
                style={[styles.inputSingle, dynamicStyles.inputSingle, {flex: 1, marginBottom: 0}]} 
                placeholder="Datum der Arbeit..." 
                placeholderTextColor={THEME.textSecondary}
                value={examDateInput} 
                onChangeText={t => setExamDateInput(formatInputDate(t))} 
              />
              <TouchableOpacity onPress={() => setExamDateInput('')} style={styles.deleteIconBtn}><Text>🗑️</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.saveBtn, {marginTop: 25, backgroundColor: THEME.primary}]} onPress={saveHwData}><Text style={styles.saveBtnText}>Speichern</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setHwModalVisible(false)}><Text style={{color: THEME.textSecondary}}>Schließen</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={subjectModalVisible}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={[styles.modalIndicator, dynamicStyles.modalIndicator]} />
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Fach auswählen</Text>
            <TouchableOpacity 
                style={[styles.chip, { backgroundColor: THEME.danger, width: '100%', alignItems: 'center', justifyContent: 'center' }]} 
                onPress={() => saveSubjectData(null, null)}
            >
                <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>Slot leeren</Text>
            </TouchableOpacity>
            <View style={styles.chipContainer}>
              {Object.keys(PREDEFINED_SUBJECTS).sort((a, b) => a.localeCompare(b)).map(s => (
                <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: PREDEFINED_SUBJECTS[s] }]} onPress={() => saveSubjectData(s, PREDEFINED_SUBJECTS[s])}><Text style={{ color: '#fff', fontWeight: '800' }}>{s}</Text></TouchableOpacity>
              ))}
            </View>
            <View style={[styles.manualSubjectSection, dynamicStyles.manualSubjectSection]}>
              <TextInput style={[styles.manualInput, dynamicStyles.manualInput]} placeholder="Eigenes Fach..." placeholderTextColor={THEME.textSecondary} value={manualSubjectName} onChangeText={setManualSubjectName} />
              <View style={styles.paletteContainer}>
                {COLOR_PALETTE.map(c => (
                  <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, manualSubjectColor === c && {borderWidth: 3, borderColor: '#fff'}]} onPress={() => setManualSubjectColor(c)} />
                ))}
              </View>
              <TouchableOpacity style={[styles.saveBtn, {marginTop: 10, backgroundColor: THEME.primary}]} onPress={() => manualSubjectName && saveSubjectData(manualSubjectName, manualSubjectColor)}><Text style={styles.saveBtnText}>+ Hinzufügen</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSubjectModalVisible(false)}><Text style={{color: THEME.textSecondary}}>Abbrechen</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={[styles.modalIndicator, dynamicStyles.modalIndicator]} />
            <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>{editingId ? 'Note bearbeiten' : 'Note hinzufügen'}</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.compactSection}>
                <Text style={[styles.compactLabel, dynamicStyles.compactLabel]}>Fach wählen:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
                  {Object.keys(PREDEFINED_SUBJECTS).sort((a, b) => a.localeCompare(b)).map(s => (
                    <TouchableOpacity 
                      key={s} 
                      onPress={() => {setSelectedSubject(s); setCustomSubject('');}} 
                      style={[styles.chipSmall, dynamicStyles.chipSmall, selectedSubject === s && !customSubject && { backgroundColor: PREDEFINED_SUBJECTS[s] }]}
                    >
                      <Text style={[styles.chipTextSmall, dynamicStyles.chipTextSmall, (selectedSubject === s && !customSubject) && { color: '#fff' }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={[styles.compactSectionCustom, dynamicStyles.compactSectionCustom]}>
                <TextInput 
                  style={[styles.manualInputCompact, dynamicStyles.manualInputCompact]} 
                  placeholder="Oder eigenes Fach..." 
                  placeholderTextColor={THEME.textSecondary}
                  value={customSubject} 
                  onChangeText={setCustomSubject} 
                />
                <View style={styles.paletteContainerCompact}>
                  {COLOR_PALETTE.map(c => (
                    <TouchableOpacity 
                      key={c} 
                      style={[styles.colorDotSmall, { backgroundColor: c }, customSubjectColor === c && styles.colorDotActive]} 
                      onPress={() => setCustomSubjectColor(c)} 
                    />
                  ))}
                </View>
              </View>

              <View style={styles.gradeInputRow}>
                <TextInput 
                  style={[styles.inputSingle, dynamicStyles.inputSingle, { flex: 1, marginBottom: 0 }]} 
                  placeholder="Note" 
                  placeholderTextColor={THEME.textSecondary}
                  value={gradeInput} 
                  keyboardType="default" 
                  onChangeText={setGradeInput} 
                />
                <TextInput 
                  style={[styles.inputSingle, dynamicStyles.inputSingle, { flex: 1.5, marginBottom: 0 }]} 
                  placeholder="Datum" 
                  placeholderTextColor={THEME.textSecondary}
                  value={dateInput} 
                  onChangeText={t => setDateInput(formatInputDate(t))} 
                />
              </View>

              <View style={styles.actionRow}>
                {editingId && (
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: THEME.danger, flex: 1 }]} onPress={deleteGrade}>
                    <Text style={styles.saveBtnText}>Löschen</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.saveBtn, { flex: 2, backgroundColor: THEME.primary }]} onPress={saveGrade}>
                  <Text style={styles.saveBtnText}>Speichern</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={{color: THEME.textSecondary, fontWeight: '600'}}>Abbrechen</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
} 

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContent: { flex: 1 },
  navHeaderFixed: { 
    flexDirection: 'row', 
    justifyContent: 'space-evenly', 
    paddingVertical: 10, 
    paddingHorizontal: 5 
  },
  navTabFixed: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 8, 
    borderRadius: 12, 
    flex: 1, 
    marginHorizontal: 2 
  },
  navTabActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  navIcon: { fontSize: 18, marginBottom: 4, textAlign: 'center' },
  navTabText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  subHeader: { marginBottom: 25, fontSize: 14 },
  linkCard: { borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 15, elevation: 2 },
  linkIconContainer: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  linkTextContainer: { flex: 1 },
  linkTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  linkDesc: { fontSize: 12 },
  arrowIcon: { fontSize: 18, fontWeight: 'bold' },
  ttContainer: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  examHeroCard: { 
    borderRadius: 18, 
    padding: 12, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3
  },
  examHeroTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 5 },
  examHeroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  examHeroSubject: { color: '#fff', fontSize: 16, fontWeight: '900', flex: 1 },
  examHeroBadge: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignItems: 'center', minWidth: 45 },
  examHeroBadgeValue: { fontSize: 16, fontWeight: '900' },
  examHeroBadgeLabel: { fontSize: 8, fontWeight: '700', marginTop: -2 },
  ttTitleCompact: { fontSize: 20, fontWeight: '900', marginBottom: 10, textAlign: 'center' },
  gridCardFull: { flex: 1, borderRadius: 15, overflow: 'hidden', elevation: 3, marginBottom: 10 },
  gridRowFull: { flex: 1, flexDirection: 'row', borderBottomWidth: 1 },
  gridRow: { flexDirection: 'row', borderBottomWidth: 1 },
  gridSideHeaderCellSmall: { 
    width: 35, 
    paddingVertical: 6, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderRightWidth: 1 
  },
  gridDayHeaderCellSmall: { 
    flex: 1, 
    paddingVertical: 6, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderRightWidth: 1 
  },
  gridHeaderTextSmall: { 
    fontWeight: '800', 
    fontSize: 11,
    textAlign: 'center'
  },
  gridSideCellSmall: { 
    width: 35, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRightWidth: 1 
  },
  gridSideTextSmall: { fontWeight: '800', fontSize: 11 },
  gridCellFull: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, padding: 1 },
  gridCellTextSmall: { fontSize: 10, fontWeight: '800', color: '#CBD5E1', textAlign: 'center' },
  iconIndicatorRowSmall: { flexDirection: 'row', gap: 2, marginTop: 2 },
  miniIconSmall: { fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: '85%' },
  modalIndicator: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteIconBtn: { padding: 12, backgroundColor: '#FEE2E2', borderRadius: 12 },
  manualSubjectSection: { padding: 15, borderRadius: 20, marginTop: 10 },
  manualInput: { padding: 12, borderRadius: 12, marginBottom: 15, fontWeight: '600' },
  paletteContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginVertical: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 4 },
  inputSingle: { padding: 15, borderRadius: 12, marginBottom: 10 },
  saveBtn: { padding: 15, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  cancelBtn: { padding: 15, alignItems: 'center' },
  statsScrollContent: { padding: 20 },
  sectionHeader: { fontSize: 20, fontWeight: '800', marginBottom: 15 },
  averageCard: { padding: 20, borderRadius: 25, alignItems: 'center', marginBottom: 20 },
  averageValue: { fontSize: 50, fontWeight: '900' },
  trendRowFull: { flexDirection: 'row', gap: 10, marginTop: 15 },
  trendBox: { padding: 10, borderRadius: 12, alignItems: 'center', flex: 1 },
  trendBoxValue: { color: '#fff', fontWeight: '800' },
  trendBoxStatus: { color: '#fff', fontSize: 9 },
  subjectStatContainer: { padding: 15, borderRadius: 15, marginBottom: 10 },
  subjectStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectLeftPart: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  subjectRightPart: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: 90 },
  subjectDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  subjectStatName: { fontSize: 16, fontWeight: '700' },
  subjectStatAvgNumber: { fontSize: 18, fontWeight: '900', textAlign: 'right' }, 
  symbolPlaceholder: { width: 15, marginLeft: 2 }, 
  subjectStatSymbol: { fontSize: 18, fontWeight: '900' },
  subjectTrendRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniTrendBox: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, minWidth: 65 },
  miniTrendContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  miniTrendLabel: { color: '#fff', fontSize: 11, fontWeight: '800' },
  miniTrendVal: { color: '#fff', fontSize: 11, fontWeight: '800' },
  miniSymbolPlaceholder: { width: 10, marginLeft: 1 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20 },
  listTitle: { fontSize: 22, fontWeight: '800' },
  addButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 24 },
  listContent: { padding: 20 },
  gradeCard: { padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  colorIndicator: { width: 4, height: '100%', marginRight: 15, borderRadius: 2 },
  subjectText: { fontSize: 16, fontWeight: '700' },
  dateText: { fontSize: 12 },
  gradeContainer: { padding: 10, borderRadius: 10 },
  gradeValueText: { fontWeight: '800' },
  compactSection: { marginBottom: 12 },
  compactLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, marginLeft: 5 },
  horizontalChips: { paddingBottom: 5 },
  chipSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginRight: 8 },
  chipTextSmall: { fontSize: 13, fontWeight: '700' },
  compactSectionCustom: { padding: 12, borderRadius: 15, marginBottom: 15, borderStyle: 'dashed', borderWidth: 1 },
  manualInputCompact: { padding: 10, borderRadius: 10, fontSize: 14, fontWeight: '600', marginBottom: 10 },
  paletteContainerCompact: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5 },
  colorDotSmall: { width: 22, height: 22, borderRadius: 11 },
  colorDotActive: { borderWidth: 2, borderColor: '#fff', scaleX: 1.2, scaleY: 1.2 },
  gradeInputRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 5 }
});

