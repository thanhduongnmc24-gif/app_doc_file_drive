import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Dimensions, TextInput, Modal, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Pdf from './PdfReader';

const DEFAULT_API_KEY = 'AIzaSyB-WBOZfXXZgehcn-8TOXG-mlE7pxfqPk8';
const DEFAULT_FOLDER_ID = '1qdFjsfepK500e395iMeyTB8zasDcZtHj';
const PROXY_SERVER_URL = 'https://tram-convert-truyen.onrender.com';

export default function App() {
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [folderId, setFolderId] = useState(DEFAULT_FOLDER_ID);
  
  const [folderStack, setFolderStack] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentBook, setCurrentBook] = useState(null); 
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textContent, setTextContent] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [jumpText, setJumpText] = useState('1');
  const [fontSize, setFontSize] = useState(18);
  
  const [showMenu, setShowMenu] = useState(false);
  const scrollViewRef = useRef(null);
  const scrollY = useRef(0); 
  const hiddenInputRef = useRef(null);

  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempFolderId, setTempFolderId] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [tocPage, setTocPage] = useState(0); 
  const ITEMS_PER_PAGE = 100;

  // CÁC STATE MỚI TÈO THÊM VÀO
  const [needsConversion, setNeedsConversion] = useState(false);
  const [hasStartedReading, setHasStartedReading] = useState(false);

  useEffect(() => {
    loadInitialSettings();
  }, []);

  useEffect(() => {
    if (currentBook && !loadingContent && !showToc && !showMenu && !needsConversion) {
      const timer = setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentBook, currentIndex, loadingContent, showToc, showMenu, needsConversion]);

  const fetchContents = async (fId, key) => {
    let allItems = [];
    let pageToken = '';
    do {
      const query = `'${fId}' in parents and trashed = false`;
      let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,shortcutDetails)&orderBy=name&key=${key}&pageSize=1000`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      if (data.files) allItems = allItems.concat(data.files);
      pageToken = data.nextPageToken;
    } while (pageToken);

    const readables = allItems.filter(f => 
      f.mimeType === 'text/plain' || 
      f.mimeType === 'application/pdf' ||
      f.name.toLowerCase().endsWith('.mobi') ||
      f.name.toLowerCase().endsWith('.azw3')
    );
    
    const folders = allItems.filter(f => f.mimeType === 'application/vnd.google-apps.folder' || f.mimeType === 'application/vnd.google-apps.shortcut');

    if (readables.length > 0) {
      return { type: 'story', files: readables.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) };
    }

    const extractedFolders = folders.map(f => {
      if (f.mimeType === 'application/vnd.google-apps.shortcut' && f.shortcutDetails) {
        return { id: f.shortcutDetails.targetId, name: f.name };
      }
      return { id: f.id, name: f.name };
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return { type: 'folders', folders: extractedFolders };
  };

  const loadInitialSettings = async () => {
    setLoading(true);
    try {
      const savedKey = await AsyncStorage.getItem('customApiKey');
      const savedFolder = await AsyncStorage.getItem('customFolderId');
      const savedFontSize = await AsyncStorage.getItem('customFontSize');
      
      const activeKey = savedKey || DEFAULT_API_KEY;
      const activeFolder = savedFolder || DEFAULT_FOLDER_ID;
      
      if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));
      setApiKey(activeKey);
      setFolderId(activeFolder);
      
      const result = await fetchContents(activeFolder, activeKey);
      
      if (result.type === 'story') {
        setFolderStack([{ id: activeFolder, name: '📚 Tàng Kinh Các', folders: [] }]);
        setCurrentBook({ id: activeFolder, name: 'Truyện gốc' });
        setFiles(result.files);
        setHasStartedReading(false);
        setTextContent('');
        
        const savedIndex = await AsyncStorage.getItem(`lastRead_${activeFolder}`);
        let initialIdx = 0;
        if (savedIndex) {
          const parsedIdx = parseInt(savedIndex, 10);
          if (parsedIdx >= 0 && parsedIdx < result.files.length) initialIdx = parsedIdx;
        }
        setCurrentIndex(initialIdx); 
        setJumpText((initialIdx + 1).toString());
        setTocPage(Math.floor(initialIdx / ITEMS_PER_PAGE));
        setShowToc(true); // Nhảy thẳng ra mục lục, không tải file nữa
      } else {
        setFolderStack([{ id: activeFolder, name: '📚 Tàng Kinh Các', folders: result.folders }]);
      }
    } catch (e) {
      alert("Lỗi khởi tạo: " + e.message);
      setFolderStack([{ id: DEFAULT_FOLDER_ID, name: '📚 Tàng Kinh Các', folders: [] }]);
    }
    setLoading(false);
  };

  const handleItemClick = async (item) => {
    setLoading(true);
    try {
      const result = await fetchContents(item.id, apiKey);
      if (result.type === 'story') {
        setCurrentBook(item);
        setShowMenu(false);
        setFiles(result.files);
        setHasStartedReading(false);
        setTextContent('');

        const savedIndex = await AsyncStorage.getItem(`lastRead_${item.id}`);
        let initialIdx = 0;
        if (savedIndex) {
          const parsedIdx = parseInt(savedIndex, 10);
          if (parsedIdx >= 0 && parsedIdx < result.files.length) initialIdx = parsedIdx;
        }
        setCurrentIndex(initialIdx); 
        setJumpText((initialIdx + 1).toString());
        setTocPage(Math.floor(initialIdx / ITEMS_PER_PAGE));
        setShowToc(true); // Chỉ hiện mục lục, chờ anh hai tự bấm
      } else {
        setFolderStack(prev => [...prev, { id: item.id, name: item.name, folders: result.folders }]);
        setSearchQuery('');
      }
    } catch (error) {
      alert("Lỗi mở thư mục: " + error.message);
    }
    setLoading(false);
  };

  // Cải tiến luồng loadContent: Chặn đứng file Kindle, chờ bấm nút
  const loadContent = async (file) => {
    if (!file) return;
    setLoadingContent(true);
    scrollY.current = 0; 
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });

    const isKindle = file.name.toLowerCase().endsWith('.mobi') || file.name.toLowerCase().endsWith('.azw3');

    if (isKindle) {
      setNeedsConversion(true);
      setTextContent('');
      setLoadingContent(false);
      setLoading(false);
      return; 
    }

    setNeedsConversion(false);

    if (file.mimeType === 'text/plain') {
      try {
        let url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
          setTextContent("Trạm trung chuyển báo lỗi hoặc file không hợp lệ anh hai ơi!");
        } else {
          const text = await response.text();
          setTextContent(text);
        }
      } catch (error) {
        setTextContent("Lỗi mạng không tải được nội dung.");
      }
    } else {
      setTextContent(''); 
    }
    setLoadingContent(false); setLoading(false);
  };

  // Hàm chuyên lo vụ Convert khi anh hai bấm nút
  const handleConvert = async () => {
    const file = files[currentIndex];
    if (!file) return;
    
    setNeedsConversion(false);
    setLoadingContent(true);
    
    try {
      const url = `${PROXY_SERVER_URL}/convert?fileId=${file.id}&apiKey=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        setTextContent("Trạm trung chuyển báo lỗi rồi anh hai ơi!");
      } else {
        const text = await response.text();
        setTextContent(text);
      }
    } catch (error) {
      setTextContent("Lỗi mạng không nhờ trạm Convert được.");
    }
    setLoadingContent(false);
  };

  const updateProgress = async (index) => {
    if (currentBook) {
      try { await AsyncStorage.setItem(`lastRead_${currentBook.id}`, index.toString()); } 
      catch (e) {}
    }
  };

  const handleScroll = (event) => { scrollY.current = event.nativeEvent.contentOffset.y; };

  const handleKeyPress = (e) => {
    const key = e.nativeEvent.key;
    const scrollStep = Dimensions.get('window').height * 0.7; 
    if (key === '1') handlePrev();
    else if (key === '3') handleNext();
    else if (key === '5') setShowMenu(prev => !prev);
    else if (key === '2') {
      const newOffset = Math.max(0, scrollY.current - scrollStep);
      scrollViewRef.current?.scrollTo({ y: newOffset, animated: true });
    } else if (key === '8') {
      const newOffset = scrollY.current + scrollStep;
      scrollViewRef.current?.scrollTo({ y: newOffset, animated: true });
    }
  };

  const handleJump = () => {
    const num = parseInt(jumpText, 10);
    if (!isNaN(num) && num >= 1 && num <= files.length) {
      const newIdx = num - 1;
      if (newIdx !== currentIndex) {
        setCurrentIndex(newIdx); updateProgress(newIdx); 
        setHasStartedReading(true);
        loadContent(files[newIdx]);
      }
    } else {
      alert(`Nhập số từ 1 đến ${files.length}`);
      setJumpText((currentIndex + 1).toString());
    }
  };

  const handleNext = async () => {
    if (currentIndex < files.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx); setJumpText((nextIdx + 1).toString());
      updateProgress(nextIdx); 
      setHasStartedReading(true);
      await loadContent(files[nextIdx]);
    }
  };

  const handlePrev = async () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx); setJumpText((prevIdx + 1).toString());
      updateProgress(prevIdx); 
      setHasStartedReading(true);
      await loadContent(files[prevIdx]);
    }
  };

  const saveSettings = async () => {
    try {
      const newKey = tempApiKey.trim() !== '' ? tempApiKey.trim() : apiKey;
      const newFolder = tempFolderId.trim() !== '' ? tempFolderId.trim() : folderId;
      
      await AsyncStorage.setItem('customApiKey', newKey);
      await AsyncStorage.setItem('customFolderId', newFolder);
      
      setApiKey(newKey); setFolderId(newFolder); 
      setShowSettings(false); setCurrentBook(null); setSearchQuery('');
      setTempApiKey(''); setTempFolderId(''); 
      
      setLoading(true);
      const result = await fetchContents(newFolder, newKey);
      if (result.type === 'story') {
        setFolderStack([{ id: newFolder, name: '📚 Tàng Kinh Các', folders: [] }]);
        setCurrentBook({ id: newFolder, name: 'Truyện gốc' });
        setFiles(result.files);
        setCurrentIndex(0); setJumpText('1');
        setTocPage(0);
        setHasStartedReading(false);
        setTextContent('');
        setShowToc(true); // Chỉ mở mục lục
      } else {
        setFolderStack([{ id: newFolder, name: '📚 Tàng Kinh Các', folders: result.folders }]);
      }
      setLoading(false);
    } catch (e) { alert('Lỗi lưu cài đặt!'); setLoading(false); }
  };

  const changeFontSize = async (delta) => {
    const newSize = fontSize + delta;
    if (newSize >= 12 && newSize <= 50) {
      setFontSize(newSize); await AsyncStorage.setItem('customFontSize', newSize.toString());
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={{ marginTop: 10, color: '#555' }}>Tèo đang mở kho sách...</Text>
      </View>
    );
  }

  // --- MÀN HÌNH TỦ SÁCH ---
  if (!currentBook) {
    const currentStackItem = folderStack[folderStack.length - 1] || { name: 'Tàng Kinh Các', folders: [] };
    const displayFolders = currentStackItem.folders;
    const filteredBooks = searchQuery.trim() === '' 
      ? displayFolders 
      : displayFolders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          {folderStack.length > 1 && (
            <TouchableOpacity onPress={() => { setFolderStack(prev => prev.slice(0, -1)); setSearchQuery(''); }} style={{paddingRight: 15}}>
              <Text style={{ fontSize: 22, color: '#007BFF' }}>⬅️</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.headerTitle, {flex: 1}]} numberOfLines={1}>{currentStackItem.name}</Text>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={{paddingLeft: 10}}>
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <TextInput 
          style={styles.searchBar} 
          placeholder="🔍 Tìm tên thư mục hoặc truyện..." 
          value={searchQuery} 
          onChangeText={setSearchQuery} 
        />

        <FlatList
          data={filteredBooks} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Thư mục này trống rỗng anh hai ơi!</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.bookItem} onPress={() => handleItemClick(item)}>
              <Text style={styles.bookIcon}>📁</Text>
              <Text style={styles.bookName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.arrowIcon}>›</Text>
            </TouchableOpacity>
          )}
        />
        
        <Modal visible={showSettings} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cài đặt Hệ thống</Text>
              
              <Text style={styles.hintText}>* Bỏ trống nếu muốn giữ nguyên</Text>
              <TextInput style={styles.settingInput} placeholder="Nhập API Key mới..." value={tempApiKey} onChangeText={setTempApiKey} />
              <TextInput style={styles.settingInput} placeholder="Nhập Folder ID tổng mới..." value={tempFolderId} onChangeText={setTempFolderId} />
              
              <View style={[styles.fontAdjuster, {marginTop: 5, marginBottom: 15}]}>
                <Text style={styles.fontLabel}>Cỡ chữ đọc truyện:</Text>
                <View style={styles.fontControls}>
                  <TouchableOpacity style={styles.fontBtn} onPress={() => changeFontSize(-2)}><Text style={styles.fontBtnText}>-</Text></TouchableOpacity>
                  <Text style={styles.fontValue}>{fontSize}</Text>
                  <TouchableOpacity style={styles.fontBtn} onPress={() => changeFontSize(2)}><Text style={styles.fontBtnText}>+</Text></TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#6c757d'}]} onPress={() => { setShowSettings(false); setTempApiKey(''); setTempFolderId(''); }}><Text style={styles.btnText}>Đóng</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#28a745'}]} onPress={saveSettings}><Text style={styles.btnText}>Lưu</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  const currentFile = files[currentIndex];
  const totalTocPages = Math.ceil(files.length / ITEMS_PER_PAGE);
  const currentTocList = files.slice(tocPage * ITEMS_PER_PAGE, (tocPage + 1) * ITEMS_PER_PAGE);
  
  const isTextBased = currentFile && (currentFile.mimeType === 'text/plain' || currentFile.name.toLowerCase().endsWith('.mobi') || currentFile.name.toLowerCase().endsWith('.azw3'));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentArea}>
        
        <TextInput
          ref={hiddenInputRef}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          autoFocus={true}
          showSoftInputOnFocus={false}
          caretHidden={true}
          inputMode="none" 
          onKeyPress={handleKeyPress}
          value=""
          onChangeText={() => {}} 
        />

        {loadingContent ? (
          <ActivityIndicator size="large" color="#007BFF" />
        ) : needsConversion ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 16, marginBottom: 20, textAlign: 'center', paddingHorizontal: 20, color: '#555' }}>
              Chương này là file {currentFile?.name.split('.').pop()}, anh hai ấn nút Convert để Tèo dịch ra chữ nha!
            </Text>
            <TouchableOpacity style={styles.convertBtn} onPress={handleConvert}>
              <Text style={styles.convertBtnText}>🚀 Convert & Đọc Ngay</Text>
            </TouchableOpacity>
          </View>
        ) : isTextBased ? (
          <ScrollView 
            ref={scrollViewRef} 
            onScroll={handleScroll} 
            scrollEventThrottle={16} 
            style={styles.textContainer}
          >
            <Text style={[styles.textContent, { fontSize: fontSize, lineHeight: fontSize * 1.6 }]}>{textContent}</Text>
          </ScrollView>
        ) : currentFile ? (
          <Pdf source={{ uri: `https://www.googleapis.com/drive/v3/files/${currentFile.id}?alt=media&key=${apiKey}` }} style={styles.pdf} onError={(e) => console.log(e)} />
        ) : (
          <Text style={{textAlign: 'center'}}>Không có nội dung</Text>
        )}

        {!showMenu && !showToc && hasStartedReading && (
          <TouchableOpacity style={styles.floatingBtn} onPress={() => setShowMenu(true)}>
            <Text style={styles.floatingBtnText}>❖</Text>
          </TouchableOpacity>
        )}
      </View>

      {showMenu && (
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={() => { setCurrentBook(null); setShowMenu(false); setHasStartedReading(false); }} style={styles.iconButton}>
            <Text style={styles.iconText}>⬅️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, currentIndex === 0 && styles.disabledBtn]} onPress={handlePrev} disabled={currentIndex === 0}>
            <Text style={styles.btnText}>{'<'}</Text>
          </TouchableOpacity>
          <View style={styles.centerNav}>
            <Text style={styles.fileTitle} numberOfLines={1}>{currentFile ? currentFile.name : 'Đang tải...'}</Text>
            <View style={styles.jumpContainer}>
              <TextInput style={styles.jumpInput} keyboardType="numeric" value={jumpText} onChangeText={setJumpText} />
              <Text style={styles.jumpLabel}>/ {files.length}</Text>
              <TouchableOpacity style={styles.goButton} onPress={handleJump}><Text style={styles.goBtnText}>Đi</Text></TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={[styles.button, currentIndex === files.length - 1 && styles.disabledBtn]} onPress={handleNext} disabled={currentIndex === files.length - 1}>
            <Text style={styles.btnText}>{'>'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowToc(true)} style={styles.iconButton}>
            <Text style={styles.iconText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(false)} style={styles.iconButton}>
            <Text style={{fontSize: 24, color: '#dc3545'}}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showToc} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '90%', width: '98%', padding: 10 }]}>
            <Text style={styles.modalTitle}>Mục lục ({tocPage + 1}/{totalTocPages || 1})</Text>
            
            <FlatList
              data={currentTocList}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
                const globalIndex = tocPage * ITEMS_PER_PAGE + index;
                const isCurrent = globalIndex === currentIndex;
                return (
                  <TouchableOpacity style={[styles.tocItem, isCurrent && styles.tocItemActive]} onPress={() => { setCurrentIndex(globalIndex); setJumpText((globalIndex + 1).toString()); updateProgress(globalIndex); setHasStartedReading(true); loadContent(files[globalIndex]); setShowToc(false); setShowMenu(false); }}>
                    <Text style={[styles.tocText, isCurrent && styles.tocTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            
            <View style={styles.tocPagination}>
              <TouchableOpacity style={[styles.modalBtn, tocPage === 0 && styles.disabledBtn]} onPress={() => setTocPage(prev => Math.max(0, prev - 1))} disabled={tocPage === 0}><Text style={styles.btnText}>⏪ Trước</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, tocPage >= (totalTocPages - 1) && styles.disabledBtn]} onPress={() => setTocPage(prev => Math.min(totalTocPages - 1, prev + 1))} disabled={tocPage >= (totalTocPages - 1)}><Text style={styles.btnText}>Tiếp ⏩</Text></TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={{backgroundColor: '#dc3545', paddingVertical: 12, borderRadius: 6, marginTop: 10, alignItems: 'center'}} 
              onPress={() => {
                setShowToc(false);
                if (!hasStartedReading) {
                  setCurrentBook(null); // Quay ra ngoài thư mục nếu chưa bắt đầu đọc
                }
              }}
            >
              <Text style={styles.btnText}>{hasStartedReading ? 'Đóng mục lục' : 'Quay lại thư mục'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#dee2e6' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#212529' },
  searchBar: { margin: 12, padding: 10, borderWidth: 1, borderColor: '#ced4da', borderRadius: 8, backgroundColor: '#f8f9fa', fontSize: 14 },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#6c757d' },
  bookItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' },
  bookIcon: { fontSize: 20, marginRight: 12 },
  bookName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  arrowIcon: { fontSize: 22, color: '#ccc', marginLeft: 10 },
  contentArea: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center' },
  textContainer: { padding: 15 },
  textContent: { color: '#212529', textAlign: 'justify' },
  pdf: { flex: 1, width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  floatingBtn: { position: 'absolute', bottom: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.1)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  floatingBtnText: { fontSize: 20, color: 'rgba(0,0,0,0.4)' },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 5, backgroundColor: '#f8f9fa', borderTopWidth: 1, borderColor: '#dee2e6' },
  button: { backgroundColor: '#007BFF', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4 },
  iconButton: { padding: 5, marginHorizontal: 2 },
  iconText: { fontSize: 18 },
  disabledBtn: { backgroundColor: '#6c757d' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  centerNav: { flex: 1, alignItems: 'center', marginHorizontal: 2 },
  fileTitle: { fontWeight: 'bold', color: '#212529', fontSize: 12, marginBottom: 2 },
  jumpContainer: { flexDirection: 'row', alignItems: 'center' },
  jumpLabel: { fontSize: 10, color: '#495057', marginHorizontal: 2 },
  jumpInput: { borderWidth: 1, borderColor: '#ced4da', borderRadius: 4, width: 35, height: 26, textAlign: 'center', fontSize: 12, backgroundColor: '#fff', padding: 0 },
  goButton: { backgroundColor: '#28a745', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 4, marginLeft: 2 },
  goBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 8, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  hintText: { fontSize: 12, color: '#dc3545', marginBottom: 10, textAlign: 'center', fontStyle: 'italic' },
  settingInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 10, marginBottom: 10, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 4, flex: 1, marginHorizontal: 5 },
  fontAdjuster: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f9fa', padding: 10, borderRadius: 4 },
  fontLabel: { fontSize: 14, fontWeight: 'bold', color: '#495057' },
  fontControls: { flexDirection: 'row', alignItems: 'center' },
  fontBtn: { backgroundColor: '#007BFF', width: 35, height: 35, borderRadius: 17.5, justifyContent: 'center', alignItems: 'center' },
  fontBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  fontValue: { fontSize: 16, fontWeight: 'bold', width: 30, textAlign: 'center', marginHorizontal: 10 },
  tocItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tocItemActive: { backgroundColor: '#e7f1ff' },
  tocText: { fontSize: 15, color: '#333' },
  tocTextActive: { fontWeight: 'bold', color: '#007BFF' },
  tocPagination: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  convertBtn: { backgroundColor: '#ff9800', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, elevation: 3 },
  convertBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});