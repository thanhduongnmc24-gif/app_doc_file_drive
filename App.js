import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Dimensions, TextInput, Modal, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Pdf from './PdfReader';

const DEFAULT_API_KEY = 'AIzaSyB-WBOZfXXZgehcn-8TOXG-mlE7pxfqPk8';
const DEFAULT_FOLDER_ID = '14Uouc776-GmsjpJCgw7SQ3sCN5KFKMCX';
export default function App() {
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [folderId, setFolderId] = useState(DEFAULT_FOLDER_ID);
  
  // Quản lý Tủ Sách
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentBook, setCurrentBook] = useState(null); 

  // Quản lý Đọc Truyện 
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [jumpText, setJumpText] = useState('1');
  const [fontSize, setFontSize] = useState(18);
  
  // Quản lý Giao diện Tàng hình & Phím cứng
  const [showMenu, setShowMenu] = useState(false); // Mặc định ẩn thanh công cụ
  const scrollViewRef = useRef(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Các Modal hỗ trợ
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempFolderId, setTempFolderId] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [tocPage, setTocPage] = useState(0); 
  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedKey = await AsyncStorage.getItem('customApiKey');
      const savedFolder = await AsyncStorage.getItem('customFolderId');
      const savedFontSize = await AsyncStorage.getItem('customFontSize');
      
      const activeKey = savedKey || DEFAULT_API_KEY;
      const activeFolder = savedFolder || DEFAULT_FOLDER_ID;
      
      if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));
      setApiKey(activeKey);
      setFolderId(activeFolder);
      
      fetchBooks(activeKey, activeFolder);
    } catch (e) {
      fetchBooks(DEFAULT_API_KEY, DEFAULT_FOLDER_ID);
    }
  };

  const fetchBooks = async (currentKey, currentFolder) => {
    setLoading(true);
    try {
      const query = `'${currentFolder}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name&key=${currentKey}&pageSize=1000`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        alert("Lỗi cấu hình Google: " + data.error.message);
        setLoading(false); return;
      }
      
      if (data.files && data.files.length > 0) {
        const sortedBooks = data.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setBooks(sortedBooks); setFilteredBooks(sortedBooks);
      } else {
        try {
          const metaUrl = `https://www.googleapis.com/drive/v3/files/${currentFolder}?fields=name&key=${currentKey}`;
          const metaResponse = await fetch(metaUrl);
          const metaData = await metaResponse.json();
          const defaultBook = [{ id: currentFolder, name: metaData.name || "Thư mục truyện gốc" }];
          setBooks(defaultBook); setFilteredBooks(defaultBook);
        } catch (e) {
          const defaultBook = [{ id: currentFolder, name: "Truyện Mặc Định" }];
          setBooks(defaultBook); setFilteredBooks(defaultBook);
        }
      }
    } catch (error) {
      alert("Lỗi kết nối tủ sách: " + error.message);
    }
    setLoading(false);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text.trim()) setFilteredBooks(books);
    else setFilteredBooks(books.filter(book => book.name.toLowerCase().includes(text.toLowerCase())));
  };

  // --- TẢI 100 CHƯƠNG ĐẦU TIÊN SIÊU TỐC ---
  const selectBook = async (book) => {
    setLoading(true);
    setCurrentBook(book);
    setShowMenu(false); // Ẩn menu khi mới vào truyện
    try {
      const query = `'${book.id}' in parents and (mimeType = 'text/plain' or mimeType = 'application/pdf') and trashed = false`;
      // Chỉ lấy 100 file đầu tiên cho nhẹ máy
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType)&orderBy=name&key=${apiKey}&pageSize=100`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        let sortedFiles = data.files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        setFiles(sortedFiles);

        const savedIndex = await AsyncStorage.getItem(`lastRead_${book.id}`);
        let initialIdx = 0;
        if (savedIndex) {
          const parsedIdx = parseInt(savedIndex, 10);
          if (parsedIdx >= 0 && parsedIdx < sortedFiles.length) initialIdx = parsedIdx;
        }
        
        setCurrentIndex(initialIdx);
        setJumpText((initialIdx + 1).toString());
        await loadContent(sortedFiles[initialIdx]);

        // Nếu còn trang tiếp theo, thả tiến trình chạy ngầm
        if (data.nextPageToken) {
          loadRestBackground(book.id, data.nextPageToken, sortedFiles);
        }
      } else {
        alert("Bộ truyện này chưa có chương nào anh hai ơi!");
        setFiles([]); setLoading(false); setCurrentBook(null);
      }
    } catch (error) {
      alert("Lỗi tải chương: " + error.message);
      setLoading(false); setCurrentBook(null);
    }
  };

  // --- TẢI NGẦM CÁC CHƯƠNG CÒN LẠI PHÍA SAU ---
  const loadRestBackground = async (bookId, initialToken, currentFiles) => {
    let allFiles = [...currentFiles];
    let pageToken = initialToken;
    try {
      do {
        const query = `'${bookId}' in parents and (mimeType = 'text/plain' or mimeType = 'application/pdf') and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType)&orderBy=name&key=${apiKey}&pageSize=1000&pageToken=${pageToken}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.files) allFiles = allFiles.concat(data.files);
        pageToken = data.nextPageToken;
      } while (pageToken);
      
      const finalSorted = allFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      setFiles(finalSorted);
    } catch (error) {
      console.log("Lỗi tải ngầm:", error);
    }
  };

  const loadContent = async (file) => {
    if (!file) return;
    setLoadingContent(true);
    setScrollOffset(0); // Reset cuộn khi sang chương mới
    if (file.mimeType === 'text/plain') {
      try {
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;
        const response = await fetch(url);
        const text = await response.text();
        setTextContent(text);
      } catch (error) {
        setTextContent("Lỗi tải nội dung file văn bản.");
      }
    } else {
      setTextContent(''); 
    }
    setLoadingContent(false); setLoading(false);
  };

  const updateProgress = async (index) => {
    if (currentBook) {
      try { await AsyncStorage.setItem(`lastRead_${currentBook.id}`, index.toString()); } 
      catch (e) {}
    }
  };

  // --- LẮNG NGHE BÀN PHÍM CỨNG ---
  const handleKeyPress = (e) => {
    const key = e.nativeEvent.key;
    const scrollStep = Dimensions.get('window').height * 0.7; // Cuộn 70% màn hình

    if (key === '1') {
      handlePrev();
    } else if (key === '3') {
      handleNext();
    } else if (key === '5') {
      setShowMenu(!showMenu);
    } else if (key === '2') {
      const newOffset = Math.max(0, scrollOffset - scrollStep);
      scrollViewRef.current?.scrollTo({ y: newOffset, animated: true });
    } else if (key === '8') {
      const newOffset = scrollOffset + scrollStep;
      scrollViewRef.current?.scrollTo({ y: newOffset, animated: true });
    }
  };

  const handleScroll = (event) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  };

  const handleJump = () => {
    const num = parseInt(jumpText, 10);
    if (!isNaN(num) && num >= 1 && num <= files.length) {
      const newIdx = num - 1;
      if (newIdx !== currentIndex) {
        setCurrentIndex(newIdx); updateProgress(newIdx); loadContent(files[newIdx]);
      }
    } else {
      alert(`Nhập số từ 1 đến ${files.length} thôi anh hai ơi!`);
      setJumpText((currentIndex + 1).toString());
    }
  };

  const handleNext = async () => {
    if (currentIndex < files.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx); setJumpText((nextIdx + 1).toString());
      updateProgress(nextIdx); await loadContent(files[nextIdx]);
    }
  };

  const handlePrev = async () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx); setJumpText((prevIdx + 1).toString());
      updateProgress(prevIdx); await loadContent(files[prevIdx]);
    }
  };

  const saveSettings = async () => {
    try {
      const newKey = tempApiKey.trim() || DEFAULT_API_KEY;
      const newFolder = tempFolderId.trim() || DEFAULT_FOLDER_ID;
      await AsyncStorage.setItem('customApiKey', newKey);
      await AsyncStorage.setItem('customFolderId', newFolder);
      setApiKey(newKey); setFolderId(newFolder); setShowSettings(false); setCurrentBook(null); 
      fetchBooks(newKey, newFolder);
    } catch (e) { alert('Lỗi lưu cài đặt!'); }
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
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>📚 Tàng Kinh Các</Text>
          <TouchableOpacity onPress={() => { setTempApiKey(apiKey === DEFAULT_API_KEY ? '' : apiKey); setTempFolderId(folderId === DEFAULT_FOLDER_ID ? '' : folderId); setShowSettings(true); }}>
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <TextInput style={styles.searchBar} placeholder="🔍 Tìm tên truyện ở đây..." value={searchQuery} onChangeText={handleSearch} />

        <FlatList
          data={filteredBooks} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>Không tìm thấy truyện nào trúng khớp hết anh hai!</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.bookItem} onPress={() => selectBook(item)}>
              <Text style={styles.bookIcon}>📖</Text>
              <Text style={styles.bookName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.arrowIcon}>›</Text>
            </TouchableOpacity>
          )}
        />
        {/* MODAL CÀI ĐẶT TỦ SÁCH */}
        <Modal visible={showSettings} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Cài đặt Hệ thống</Text>
              <TextInput style={styles.settingInput} placeholder="Nhập API Key..." value={tempApiKey} onChangeText={setTempApiKey} />
              <TextInput style={styles.settingInput} placeholder="Nhập Folder ID tổng..." value={tempFolderId} onChangeText={setTempFolderId} />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#6c757d'}]} onPress={() => setShowSettings(false)}><Text style={styles.btnText}>Đóng</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#28a745'}]} onPress={saveSettings}><Text style={styles.btnText}>Lưu</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // --- MÀN HÌNH ĐỌC TRUYỆN ---
  const currentFile = files[currentIndex];
  const totalTocPages = Math.ceil(files.length / ITEMS_PER_PAGE);
  const currentTocList = files.slice(tocPage * ITEMS_PER_PAGE, (tocPage + 1) * ITEMS_PER_PAGE);

  return (
    <SafeAreaView style={styles.container}>
      {/* KHU VỰC ĐỌC TRUYỆN */}
      <View style={styles.contentArea}>
        
        {/* HACK LẮNG NGHE BÀN PHÍM CỨNG MÀ KHÔNG HIỆN BÀN PHÍM ẢO */}
        <TextInput
          style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
          autoFocus={true}
          showSoftInputOnFocus={false}
          onKeyPress={handleKeyPress}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {loadingContent ? (
          <ActivityIndicator size="large" color="#007BFF" />
        ) : currentFile && currentFile.mimeType === 'text/plain' ? (
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

        {/* NÚT TÀNG HÌNH ĐỂ GỌI MENU */}
        {!showMenu && (
          <TouchableOpacity style={styles.floatingBtn} onPress={() => setShowMenu(true)}>
            <Text style={styles.floatingBtnText}>❖</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* THANH MENU (CHỈ HIỆN KHI SHOWMENU = TRUE) */}
      {showMenu && (
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={() => { setCurrentBook(null); setShowMenu(false); }} style={styles.iconButton}>
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
              <TouchableOpacity style={styles.goButton} onPress={handleJump}>
                <Text style={styles.goBtnText}>Đi</Text>
              </TouchableOpacity>
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

      {/* MODAL MỤC LỤC */}
      <Modal visible={showToc} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '85%' }]}>
            <Text style={styles.modalTitle}>Mục lục ({tocPage + 1}/{totalTocPages || 1})</Text>
            <FlatList
              data={currentTocList}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
                const globalIndex = tocPage * ITEMS_PER_PAGE + index;
                const isCurrent = globalIndex === currentIndex;
                return (
                  <TouchableOpacity style={[styles.tocItem, isCurrent && styles.tocItemActive]} onPress={() => { setCurrentIndex(globalIndex); setJumpText((globalIndex + 1).toString()); updateProgress(globalIndex); loadContent(files[globalIndex]); setShowToc(false); setShowMenu(false); }}>
                    <Text style={[styles.tocText, isCurrent && styles.tocTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={styles.tocPagination}>
              <TouchableOpacity style={[styles.modalBtn, tocPage === 0 && styles.disabledBtn]} onPress={() => setTocPage(prev => Math.max(0, prev - 1))} disabled={tocPage === 0}><Text style={styles.btnText}>⏪ Trước</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, tocPage >= (totalTocPages - 1) && styles.disabledBtn]} onPress={() => setTocPage(prev => Math.min(totalTocPages - 1, prev + 1))} disabled={tocPage >= (totalTocPages - 1)}><Text style={styles.btnText}>Tiếp ⏩</Text></TouchableOpacity>
            </View>
            
            {/* Lồng Nút chỉnh cỡ chữ vào Mục lục cho tiện */}
            <View style={[styles.fontAdjuster, {marginTop: 10}]}>
              <Text style={styles.fontLabel}>Cỡ chữ:</Text>
              <View style={styles.fontControls}>
                <TouchableOpacity style={styles.fontBtn} onPress={() => changeFontSize(-2)}><Text style={styles.fontBtnText}>-</Text></TouchableOpacity>
                <Text style={styles.fontValue}>{fontSize}</Text>
                <TouchableOpacity style={styles.fontBtn} onPress={() => changeFontSize(2)}><Text style={styles.fontBtnText}>+</Text></TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#6c757d', marginTop: 10}]} onPress={() => setShowToc(false)}><Text style={styles.btnText}>Đóng</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#dee2e6' },
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
  
  // Nút gọi menu tàng hình
  floatingBtn: { position: 'absolute', bottom: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.1)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  floatingBtnText: { fontSize: 20, color: 'rgba(0,0,0,0.4)' },

  // Thanh công cụ bật lên
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
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  settingInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 10, marginBottom: 10, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 4, flex: 1, marginHorizontal: 5 },
  
  fontAdjuster: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f9fa', padding: 10, borderRadius: 4 },
  fontLabel: { fontSize: 14, fontWeight: 'bold', color: '#495057' },
  fontControls: { flexDirection: 'row', alignItems: 'center' },
  fontBtn: { backgroundColor: '#007BFF', width: 35, height: 35, borderRadius: 17.5, justifyContent: 'center', alignItems: 'center' },
  fontBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  fontValue: { fontSize: 16, fontWeight: 'bold', width: 30, textAlign: 'center', marginHorizontal: 10 },

  tocItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tocItemActive: { backgroundColor: '#e7f1ff' },
  tocText: { fontSize: 16, color: '#333' },
  tocTextActive: { fontWeight: 'bold', color: '#007BFF' },
  tocPagination: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }
});