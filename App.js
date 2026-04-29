import React, { useState, useEffect } from 'react';
import { 
  Text, View, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, Modal, SafeAreaView, FlatList, StatusBar, Dimensions, Linking
} from 'react-native'; 
// Import für den Speicher
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PREDEFINED_SUBJECTS = {
  'Englisch': '#5C6BC0', 'Mathe': '#2979FF', 'Deutsch': '#FF5252',  
  'Geo': '#00B8D4', 'Bio': '#43A047', 'Ethik': '#FF9100',    
  'Kunst': '#AB47BC', 'Sport': '#FDD835', 'Musik': '#F06292',    
  'Medien': '#78909C', 'KL-Stunde': '#455A64', 'MGirls': '#EC407A',
}; 

const COLOR_PALETTE = [
  '#FF5252', '#FF9100', '#FDD835', '#43A047', '#00B8D4', '#2979FF', '#5C6BC0', '#AB47BC', '#F06292', '#455A64'
];

const THEME = {
  primary: '#2979FF', secondary: '#1C2E4A', background: '#F8FAFC',  
  card: '#FFFFFF', textMain: '#1E293B', textSecondary: '#64748B',
  white: '#FFFFFF', success: '#00C853', danger: '#FF1744', warning: '#FFAB00', accent: '#6366F1'
};

const DAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];
const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// --- Hilfsfunktionen ---
const getPureNumber = (gradeStr) => {
  if (!gradeStr) return 0;
  const num = parseFloat(gradeStr.toString().replace(',', '.'));
  return isNaN(num) ? 0 : num;
}; 

const getMostFrequentSymbol = (gradesList) => {
  if (!gradesList || gradesList.length === 0) return "";
  let counts = { plus: 0, minus: 0 };
  gradesList.forEach(g => {
    if (g.displayGrade.includes('+')) counts.plus++;
    else if (g.displayGrade.includes('-')) counts.minus++;
  });
  return counts.plus > counts.minus ? "+" : (counts.minus > counts.plus ? "-" : ""); 
}; 

const parseDate = (dateStr) => {
  if (!dateStr || !dateStr.includes('.')) return 0;
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

const calculateTrends = (gradesList) => {
  const avg3 = getRawAverageForMonths(gradesList, 3);
  const avg6 = getRawAverageForMonths(gradesList, 6);
  const avg12 = getRawAverageForMonths(gradesList, 12);

  const calcTrend = (newVal, oldVal, label) => {
    if (newVal === null) return null;
    let status = "Stabil";
    let color = THEME.warning;
    if (oldVal !== null) {
        const diff = newVal - oldVal;
        if (diff < -0.1) { status = "Besser"; color = THEME.success; }
        else if (diff > 0.1) { status = "Schlechter"; color = THEME.danger; }
    }
    const limit = Date.now() - (parseInt(label) * 30 * 24 * 60 * 60 * 1000);
    const relevantGrades = gradesList.filter(g => parseDate(g.date) >= limit);
    const symbol = getMostFrequentSymbol(relevantGrades);
    const numericPart = newVal.toFixed(1).replace('.', ',');
    return { label, text: status, color, val: numericPart, symbol: symbol };
  };

  return [
    calcTrend(avg3, avg6, "3m"),
    calcTrend(avg6, avg12, "6m"),
    calcTrend(avg12, null, "12m")
  ].filter(t => t !== null);
};

export default function App() {
  const [grades, setGrades] = useState([]);
  const [timetable, setTimetable] = useState({});
  const [activeTab, setActiveTab] = useState('notes'); 
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState('Mathe');
  const [gradeInput, setGradeInput] = useState(''); 
  const [customSubject, setCustomSubject] = useState('');
  const [dateInput, setDateInput] = useState(''); 
  const [hwModalVisible, setHwModalVisible] = useState(false);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null); 
  const [hwInput, setHwInput] = useState('');
  const [examDateInput, setExamDateInput] = useState('');
  const [manualSubjectName, setManualSubjectName] = useState('');
  const [manualSubjectColor, setManualSubjectColor] = useState(COLOR_PALETTE[0]);

  // --- PERSISTENZ (Speichern & Laden) ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedGrades = await AsyncStorage.getItem('user_grades_final');
        const savedTT = await AsyncStorage.getItem('user_tt_final');
        if (savedGrades) setGrades(JSON.parse(savedGrades));
        if (savedTT) setTimetable(JSON.parse(savedTT));
      } catch (e) { console.error("Laden fehlgeschlagen", e); }
    };
    loadData();
  }, []);

  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem('user_grades_final', JSON.stringify(grades));
        await AsyncStorage.setItem('user_tt_final', JSON.stringify(timetable));
      } catch (e) { console.error("Speichern fehlgeschlagen", e); }
    };
    saveData();
  }, [grades, timetable]);

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
    const finalColor = isCustom ? '#455A64' : PREDEFINED_SUBJECTS[selectedSubject];
    if (editingId) {
      setGrades(grades.map(g => g.id === editingId ? { ...g, subject: finalSubjectName, displayGrade: gradeInput, date: dateInput, color: finalColor } : g));
    } else {
      setGrades([{ id: Date.now().toString(), subject: finalSubjectName, displayGrade: gradeInput, date: dateInput, color: finalColor }, ...grades]);
    }
    closeModal();
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
        trends: calculateTrends(stats[name].raw) 
      };
    }).sort((a, b) => a.rawAvg - b.rawAvg);
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
    { title: 'Schulportal Hessen', desc: 'Anmeldung, Login', url: 'https://login.schulportal.hessen.de/', icon: '🔐' },
    { title: 'Infos Musterschule', desc: 'Allgemeine Schulnachrichten', url: 'https://infos.musterschule.de/', icon: '📰' },
    { title: 'Bärenstark Schule', desc: 'Essensbestellung Mensa', url: 'https://baerenstark-schule.de/mobil/#/login', icon: '🐻' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.navHeaderFixed}>
        {['notes', 'stats', 'timetable', 'pattern'].map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.navTabFixed, activeTab === tab && styles.navTabActive]} 
            onPress={() => setActiveTab(tab)}
          >
            <Text style={styles.navIcon}>{tab === 'notes' ? '📝' : tab === 'stats' ? '📊' : tab === 'timetable' ? '📅' : '🏫'}</Text>
            <Text style={[styles.navTabText, activeTab === tab && styles.navTabTextActive]} numberOfLines={1}>
              {tab === 'notes' ? 'Noten' : tab === 'stats' ? 'Statistik' : tab === 'timetable' ? 'Plan' : 'Muster'}
            </Text>
          </TouchableOpacity>
        ))}
      </View> 

      {activeTab === 'stats' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.statsScrollContent}>
          <Text style={styles.sectionHeader}>Gesamt-Statistik</Text>
          <View style={styles.averageCard}>
            <Text style={styles.averageValue}>{grades.length > 0 ? `${(grades.reduce((a,c) => a + getPureNumber(c.displayGrade), 0) / grades.length).toFixed(1).replace('.', ',')}${getMostFrequentSymbol(grades)}` : "—"}</Text>
            <View style={styles.trendRowFull}>
              {calculateTrends(grades).map((t, idx) => (
                <View key={idx} style={[styles.trendBox, { backgroundColor: t.color }]}>
                  <Text style={styles.trendBoxValue}>{t.val}{t.symbol}</Text>
                  <Text style={styles.trendBoxStatus}>{t.text}</Text>
                </View>
              ))}
            </View>
          </View>
          <Text style={styles.sectionHeader}>Einzelne Fächer</Text>
          {getSubjectStats().map((item, idx) => (
            <View key={idx} style={styles.subjectStatContainer}>
              <View style={styles.subjectStatRow}>
                <View style={styles.subjectLeftPart}>
                    <View style={[styles.subjectDot, { backgroundColor: item.color }]} />
                    <Text style={styles.subjectStatName} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={styles.subjectRightPart}>
                    <Text style={styles.subjectStatAvgNumber}>{item.avg}</Text>
                    <View style={styles.symbolPlaceholder}>
                        <Text style={styles.subjectStatSymbol}>{item.symbol}</Text>
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

      {activeTab === 'pattern' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.sectionHeader}>Schul-Links</Text>
          {musterLinks.map((link, idx) => (
            <TouchableOpacity key={idx} style={styles.linkCard} onPress={() => Linking.openURL(link.url)}>
              <View style={styles.linkIconContainer}><Text style={{ fontSize: 24 }}>{link.icon}</Text></View>
              <View style={styles.linkTextContainer}>
                <Text style={styles.linkTitle}>{link.title}</Text>
                <Text style={styles.linkDesc}>{link.desc}</Text>
              </View>
              <Text style={styles.arrowIcon}>→</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {activeTab === 'timetable' && (
        <View style={styles.ttContainer}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
            {getNextExamCountdown() && (
              <View style={[styles.examHeroCard, { flex: 1, backgroundColor: THEME.danger }]}>
                  <Text style={styles.examHeroTitle}>Nächste Arbeit</Text>
                  <View style={styles.examHeroContent}>
                      <Text style={styles.examHeroSubject} numberOfLines={1}>{getNextExamCountdown().name}</Text>
                      <View style={styles.examHeroBadge}>
                          <Text style={styles.examHeroBadgeValue}>{getNextExamCountdown().days}</Text>
                          <Text style={styles.examHeroBadgeLabel}>Tage</Text>
                      </View>
                  </View>
              </View>
            )}
            {getHolidayCountdown() && (
              <View style={[styles.examHeroCard, { flex: 1, backgroundColor: THEME.success }]}>
                  <Text style={styles.examHeroTitle}>Ferien</Text>
                  <View style={styles.examHeroContent}>
                      <Text style={styles.examHeroSubject}>Countdown</Text>
                      <View style={styles.examHeroBadge}>
                          <Text style={[styles.examHeroBadgeValue, { color: THEME.success }]}>{getHolidayCountdown()}</Text>
                          <Text style={[styles.examHeroBadgeLabel, { color: THEME.success }]}>Tage</Text>
                      </View>
                  </View>
              </View>
            )}
          </View>

          <View style={styles.gridCardFull}>
            <View style={styles.gridRow}>
              <View style={styles.gridHeaderCellSmall}><Text style={styles.gridHeaderTextSmall}>Std.</Text></View>
              {DAYS_SHORT.map(day => (
                <View key={day} style={styles.gridHeaderCellSmall}><Text style={styles.gridHeaderTextSmall}>{day}</Text></View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              {HOURS.map(hour => (
                <View key={hour} style={styles.gridRowFull}>
                  <View style={styles.gridSideCellSmall}><Text style={styles.gridSideTextSmall}>{hour}.</Text></View>
                  {DAYS_SHORT.map((day, dIdx) => {
                    const subjectData = timetable[`${dIdx}-${hour}`];
                    return (
                      <TouchableOpacity 
                        key={dIdx} 
                        style={[styles.gridCellFull, subjectData && { backgroundColor: subjectData.color }]}
                        onPress={() => handleShortPress(dIdx, hour)}
                        onLongPress={() => handleLongPress(dIdx, hour)}
                      >
                        <Text style={[styles.gridCellTextSmall, subjectData && { color: '#fff' }]} numberOfLines={1}>
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

      {activeTab === 'notes' && (
        <View style={{ flex: 1 }}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Deine Noten</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
          </View>
          <FlatList data={[...grades].sort((a,b) => parseDate(b.date) - parseDate(a.date))} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent} renderItem={({ item }) => (
            <View style={styles.gradeCard}>
              <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { setEditingId(item.id); setGradeInput(item.displayGrade); setDateInput(item.date); setSelectedSubject(item.subject); setModalVisible(true); }}>
                <Text style={styles.subjectText}>{item.subject}</Text>
                <Text style={styles.dateText}>{item.date}</Text> 
              </TouchableOpacity>
              <View style={styles.gradeContainer}><Text style={styles.gradeValueText}>{item.displayGrade}</Text></View>
              <TouchableOpacity onPress={() => setGrades(grades.filter(g => g.id !== item.id))} style={{marginLeft: 10}}><Text>🗑️</Text></TouchableOpacity>
            </View>
          )} />
        </View>
      )}

      {/* MODALS */}
      <Modal animationType="fade" transparent={true} visible={hwModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>Aufgaben & Termine</Text>
            <View style={styles.inputRow}>
              <TextInput style={[styles.inputSingle, {flex: 1, marginBottom: 0}]} placeholder="Hausaufgabe..." value={hwInput} onChangeText={setHwInput} />
              <TouchableOpacity onPress={() => setHwInput('')} style={styles.deleteIconBtn}><Text>🗑️</Text></TouchableOpacity>
            </View>
            <View style={[styles.inputRow, {marginTop: 15}]}>
              <TextInput style={[styles.inputSingle, {flex: 1, marginBottom: 0}]} placeholder="Datum Arbeit..." value={examDateInput} onChangeText={t => setExamDateInput(formatInputDate(t))} />
              <TouchableOpacity onPress={() => setExamDateInput('')} style={styles.deleteIconBtn}><Text>🗑️</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.saveBtn, {marginTop: 25}]} onPress={saveHwData}><Text style={styles.saveBtnText}>Speichern</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setHwModalVisible(false)}><Text>Schließen</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={subjectModalVisible}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalIndicator} />
            <Text style={styles.modalTitle}>Fach auswählen</Text>
            <TouchableOpacity style={[styles.chip, { backgroundColor: THEME.danger, alignItems: 'center' }]} onPress={() => saveSubjectData(null, null)}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Slot leeren</Text>
            </TouchableOpacity>
            <View style={styles.chipContainer}>
              {Object.keys(PREDEFINED_SUBJECTS).map(s => (
                <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: PREDEFINED_SUBJECTS[s] }]} onPress={() => saveSubjectData(s, PREDEFINED_SUBJECTS[s])}><Text style={{ color: '#fff', fontWeight: '800' }}>{s}</Text></TouchableOpacity>
              ))}
            </View>
            <View style={styles.manualSubjectSection}>
              <TextInput style={styles.manualInput} placeholder="Eigenes Fach..." value={manualSubjectName} onChangeText={setManualSubjectName} />
              <View style={styles.paletteContainer}>
                {COLOR_PALETTE.map(c => (
                  <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c }, manualSubjectColor === c && {borderWidth: 3, borderColor: '#fff'}]} onPress={() => setManualSubjectColor(c)} />
                ))}
              </View>
              <TouchableOpacity style={[styles.saveBtn, {marginTop: 10}]} onPress={() => manualSubjectName && saveSubjectData(manualSubjectName, manualSubjectColor)}><Text style={styles.saveBtnText}>+ Hinzufügen</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setSubjectModalVisible(false)}><Text>Abbrechen</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Note speichern</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15 }}>
              {Object.keys(PREDEFINED_SUBJECTS).map(s => (
                <TouchableOpacity key={s} onPress={() => setSelectedSubject(s)} style={[styles.chip, selectedSubject === s && { backgroundColor: THEME.primary }]}><Text style={[styles.chipText, selectedSubject === s && { color: '#fff' }]}>{s}</Text></TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput style={styles.inputSingle} placeholder="Note" value={gradeInput} onChangeText={setGradeInput} />
            <TextInput style={styles.inputSingle} placeholder="Datum" value={dateInput} onChangeText={t => setDateInput(formatInputDate(t))} />
            <TouchableOpacity style={styles.saveBtn} onPress={saveGrade}><Text style={styles.saveBtnText}>Speichern</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}><Text>Abbrechen</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
} 

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.background },
  navHeaderFixed: { backgroundColor: THEME.secondary, flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: 10, paddingHorizontal: 5 },
  navTabFixed: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 12, flex: 1, marginHorizontal: 2 },
  navTabActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  navIcon: { fontSize: 18, marginBottom: 4 },
  navTabText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  navTabTextActive: { color: THEME.white },
  linkCard: { backgroundColor: THEME.card, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 15, elevation: 2 },
  linkIconContainer: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  linkTextContainer: { flex: 1 },
  linkTitle: { fontSize: 16, fontWeight: '800', color: THEME.textMain },
  linkDesc: { fontSize: 12, color: THEME.textSecondary },
  arrowIcon: { fontSize: 18, color: THEME.primary },
  ttContainer: { flex: 1, padding: 12 },
  examHeroCard: { borderRadius: 18, padding: 12, elevation: 3 },
  examHeroTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  examHeroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  examHeroSubject: { color: '#fff', fontSize: 16, fontWeight: '900' },
  examHeroBadge: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignItems: 'center' },
  examHeroBadgeValue: { fontSize: 16, fontWeight: '900' },
  examHeroBadgeLabel: { fontSize: 8, fontWeight: '700' },
  gridCardFull: { flex: 1, backgroundColor: THEME.card, borderRadius: 15, overflow: 'hidden', elevation: 3 },
  gridRowFull: { flex: 1, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  gridRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  gridHeaderCellSmall: { flex: 1, paddingVertical: 6, backgroundColor: '#F8FAFC', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  gridHeaderTextSmall: { fontWeight: '800', fontSize: 11 },
  gridSideCellSmall: { width: 35, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  gridSideTextSmall: { fontWeight: '800', fontSize: 11 },
  gridCellFull: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  gridCellTextSmall: { fontSize: 10, fontWeight: '800', color: '#CBD5E1' },
  iconIndicatorRowSmall: { flexDirection: 'row', gap: 2 },
  miniIconSmall: { fontSize: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  modalIndicator: { width: 40, height: 5, backgroundColor: '#E2E8F0', borderRadius: 3, alignSelf: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 20, textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteIconBtn: { padding: 12, backgroundColor: '#FEE2E2', borderRadius: 12 },
  manualSubjectSection: { padding: 15, backgroundColor: '#F1F5F9', borderRadius: 20, marginTop: 20 },
  manualInput: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 15 },
  paletteContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginVertical: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 5, backgroundColor: '#F1F5F9' },
  chipText: { fontWeight: '600' },
  inputSingle: { backgroundColor: '#F1F5F9', padding: 15, borderRadius: 12, marginBottom: 10 },
  saveBtn: { backgroundColor: THEME.primary, padding: 15, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
  cancelBtn: { padding: 15, alignItems: 'center' },
  statsScrollContent: { padding: 20 },
  sectionHeader: { fontSize: 20, fontWeight: '800', color: THEME.secondary, marginBottom: 15 },
  averageCard: { backgroundColor: THEME.card, padding: 20, borderRadius: 25, alignItems: 'center', marginBottom: 20 },
  averageValue: { fontSize: 50, fontWeight: '900', color: THEME.primary },
  trendRowFull: { flexDirection: 'row', gap: 10, marginTop: 15 },
  trendBox: { padding: 10, borderRadius: 12, alignItems: 'center', flex: 1 },
  trendBoxValue: { color: '#fff', fontWeight: '800' },
  trendBoxStatus: { color: '#fff', fontSize: 9 },
  subjectStatContainer: { backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 10 },
  subjectStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectLeftPart: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  subjectRightPart: { flexDirection: 'row', alignItems: 'center' },
  subjectDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  subjectStatName: { fontSize: 16, fontWeight: '700' },
  subjectStatAvgNumber: { fontSize: 18, fontWeight: '900' }, 
  symbolPlaceholder: { width: 15, marginLeft: 2 }, 
  subjectStatSymbol: { fontSize: 18, fontWeight: '900' },
  subjectTrendRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniTrendBox: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  miniTrendContent: { flexDirection: 'row', alignItems: 'center' },
  miniTrendLabel: { color: '#fff', fontSize: 11, fontWeight: '800' },
  miniTrendVal: { color: '#fff', fontSize: 11, fontWeight: '800' },
  miniSymbolPlaceholder: { width: 10 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20 },
  listTitle: { fontSize: 22, fontWeight: '800' },
  addButton: { backgroundColor: THEME.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 24 },
  listContent: { padding: 20 },
  gradeCard: { backgroundColor: '#fff', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  colorIndicator: { width: 4, height: '100%', marginRight: 15 },
  subjectText: { fontSize: 16, fontWeight: '700' },
  dateText: { fontSize: 12, color: THEME.textSecondary },
  gradeContainer: { backgroundColor: '#F1F5F9', padding: 10, borderRadius: 10 },
  gradeValueText: { fontWeight: '800' },
});

