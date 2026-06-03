import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Dimensions, Platform, TextInput, Modal, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Pdf from './PdfReader';

// Cấu hình gốc (Phòng hờ khi anh hai xóa trắng Cài đặt)
const DEFAULT_API_KEY = 'AIzaSyB-WBOZfXXZgehcn-8TOXG-mlE7pxfqPk8';
const DEFAULT_FOLDER_ID = '14Uouc776-GmsjpJCgw7SQ3sCN5KFKMCX';

export default function App() {
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [folderId, setFolderId] = useState(DEFAULT_FOLDER_ID);
  
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [jumpText, setJumpText] = useState('1');

  // Trạng thái cho Modal Cài đặt
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [tempFolderId, setTempFolderId] = useState('');

  // Trạng thái cho Modal Mục lục
  const [showToc, setShowToc] = useState(false);
  const [tocPage, setTocPage] = useState(0); // Bắt đầu từ trang 0 (chương 1-100)
  const ITEMS_PER_PAGE = 100;

  useEffect(() => {
    loadSettings();
  }, []);

  // Đọc cấu hình từ bộ nhớ điện thoại
  const loadSettings = async () => {
    try {
      const savedKey = await AsyncStorage.getItem('customApiKey');
      const savedFolder = await AsyncStorage.getItem('customFolderId');
      
      const activeKey = savedKey || DEFAULT_API_KEY;
      const activeFolder = savedFolder || DEFAULT_FOLDER_ID;
      
      setApiKey(activeKey);
      setFolderId(activeFolder);
      fetchFiles(activeKey, activeFolder);
    } catch (e) {
      fetchFiles(DEFAULT_API_KEY, DEFAULT_FOLDER_ID);
    }
  };

  const saveSettings = async () => {
    try {
      const newKey = tempApiKey.trim() || DEFAULT_API_KEY;
      const newFolder = tempFolderId.trim() || DEFAULT_FOLDER_ID;
      
      await AsyncStorage.setItem('customApiKey', newKey);
      await AsyncStorage.setItem('customFolderId', newFolder);
      
      setApiKey(newKey);
      setFolderId(newFolder);
      setShowSettings(false);
      setLoading(true);
      fetchFiles(newKey, newFolder);
    } catch (e) {
      alert('Lỗi khi lưu cài đặt!');
    }
  };

  const fetchFiles = async (currentKey, currentFolder) => {
    try {
      const query = `'${currentFolder}' in parents and (mimeType = 'text/plain' or mimeType = 'application/pdf') and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=name&key=${currentKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        alert("Lỗi cấu hình Google: " + data.error.message);
        setLoading(false);
        return;
      }
      
      if (data.files && data.files.length > 0) {
        // Thuật toán sắp xếp A-Z thông minh (nhận diện số)
        const sortedFiles = data.files.sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        setFiles(sortedFiles);
        setCurrentIndex(0);
        setJumpText('1');
        await loadContent(sortedFiles[0], currentKey);
      } else {
        alert("Thư mục trống hoặc quyền riêng tư chưa mở!");
        setFiles([]);
        setLoading(false);
      }
    } catch (error) {
      alert("Lỗi kết nối: " + error.message);
      setLoading(false);
    }
  };

  const loadContent = async (file, currentKey = apiKey) => {
    if (!file) return;
    setLoadingContent(true);
    if (file.mimeType === 'text/plain') {
      try {
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${currentKey}`;
        const response = await fetch(url);
        const text = await response.text();
        setTextContent(text);
      } catch (error) {
        setTextContent("Lỗi tải nội dung file văn bản.");
      }
    } else {
      setTextContent(''); 
    }
    setLoadingContent(false);
    setLoading(false);
  };

  // Nút Đi cho ô nhập số trang
  const handleJump = () => {
    const num = parseInt(jumpText, 10);
    if (!isNaN(num) && num >= 1 && num <= files.length) {
      const newIdx = num - 1;
      if (newIdx !== currentIndex) {
        setCurrentIndex(newIdx);
        loadContent(files[newIdx]);
      }
    } else {
      alert(`Nhập số từ 1 đến ${files.length} thôi anh hai ơi!`);
      setJumpText((currentIndex + 1).toString());
    }
  };

  const handleNext = async () => {
    if (currentIndex < files.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setJumpText((nextIdx + 1).toString());
      await loadContent(files[nextIdx]);
    }
  };

  const handlePrev = async () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setJumpText((prevIdx + 1).toString());
      await loadContent(files[prevIdx]);
    }
  };

  const openSettings = () => {
    setTempApiKey(apiKey === DEFAULT_API_KEY ? '' : apiKey);
    setTempFolderId(folderId === DEFAULT_FOLDER_ID ? '' : folderId);
    setShowSettings(true);
  };

  // Logic chia trang cho Mục lục
  const totalTocPages = Math.ceil(files.length / ITEMS_PER_PAGE);
  const currentTocList = files.slice(tocPage * ITEMS_PER_PAGE, (tocPage + 1) * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={{ marginTop: 10, color: '#555' }}>Tèo đang kết nối kho sách...</Text>
      </View>
    );
  }

  const currentFile = files[currentIndex];

  const NavigationButtons = () => (
    <View style={styles.navBar}>
      <TouchableOpacity onPress={openSettings} style={styles.iconButton}>
        <Text style={styles.iconText}>⚙️</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, currentIndex === 0 && styles.disabledBtn]} 
        onPress={handlePrev} 
        disabled={currentIndex === 0}
      >
        <Text style={styles.btnText}>{'<'}</Text>
      </TouchableOpacity>
      
      <View style={styles.centerNav}>
        <Text style={styles.fileTitle} numberOfLines={1}>{currentFile ? currentFile.name : 'Chưa có file'}</Text>
        <View style={styles.jumpContainer}>
          <TextInput 
            style={styles.jumpInput}
            keyboardType="numeric"
            value={jumpText}
            onChangeText={setJumpText}
          />
          <Text style={styles.jumpLabel}>/ {files.length}</Text>
          <TouchableOpacity style={styles.goButton} onPress={handleJump}>
            <Text style={styles.goBtnText}>Đi</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[styles.button, currentIndex === files.length - 1 && styles.disabledBtn]} 
        onPress={handleNext} 
        disabled={currentIndex === files.length - 1}
      >
        <Text style={styles.btnText}>{'>'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowToc(true)} style={styles.iconButton}>
        <Text style={styles.iconText}>☰</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {files.length > 0 && <NavigationButtons />}
      
      <View style={styles.contentArea}>
        {files.length === 0 ? (
          <View style={styles.center}>
            <Text>Kho sách trống rỗng! Anh hai vào ⚙️ kiểm tra lại ID nhé.</Text>
            <TouchableOpacity onPress={openSettings} style={[styles.button, {marginTop: 15}]}>
              <Text style={styles.btnText}>Mở Cài đặt</Text>
            </TouchableOpacity>
          </View>
        ) : loadingContent ? (
          <ActivityIndicator size="large" color="#007BFF" />
        ) : currentFile.mimeType === 'text/plain' ? (
          <ScrollView style={styles.textContainer}>
            <Text style={styles.textContent}>{textContent}</Text>
          </ScrollView>
        ) : (
          <Pdf
            source={{ uri: `https://www.googleapis.com/drive/v3/files/${currentFile.id}?alt=media&key=${apiKey}` }}
            style={styles.pdf}
            onError={(error) => console.log("Lỗi render PDF:", error)}
          />
        )}
      </View>
      
      {files.length > 0 && <NavigationButtons />}

      {/* MODAL CÀI ĐẶT */}
      <Modal visible={showSettings} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cài đặt API & Thư mục</Text>
            <Text style={styles.modalSub}>Để trống sẽ dùng cấu hình gốc của App.</Text>
            
            <TextInput
              style={styles.settingInput}
              placeholder="Nhập API Key mới..."
              value={tempApiKey}
              onChangeText={setTempApiKey}
            />
            <TextInput
              style={styles.settingInput}
              placeholder="Nhập Folder ID mới..."
              value={tempFolderId}
              onChangeText={setTempFolderId}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#6c757d'}]} onPress={() => setShowSettings(false)}>
                <Text style={styles.btnText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#28a745'}]} onPress={saveSettings}>
                <Text style={styles.btnText}>Lưu & Tải lại</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL MỤC LỤC */}
      <Modal visible={showToc} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.modalTitle}>Mục lục (Trang {tocPage + 1}/{totalTocPages})</Text>
            
            <FlatList
              data={currentTocList}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
                const globalIndex = tocPage * ITEMS_PER_PAGE + index;
                const isCurrent = globalIndex === currentIndex;
                return (
                  <TouchableOpacity 
                    style={[styles.tocItem, isCurrent && styles.tocItemActive]}
                    onPress={() => {
                      setCurrentIndex(globalIndex);
                      setJumpText((globalIndex + 1).toString());
                      loadContent(files[globalIndex]);
                      setShowToc(false);
                    }}
                  >
                    <Text style={[styles.tocText, isCurrent && styles.tocTextActive]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            <View style={styles.tocPagination}>
              <TouchableOpacity 
                style={[styles.modalBtn, tocPage === 0 && styles.disabledBtn]} 
                onPress={() => setTocPage(prev => Math.max(0, prev - 1))}
                disabled={tocPage === 0}
              >
                <Text style={styles.btnText}>⏪ 100 Chương trước</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, tocPage >= totalTocPages - 1 && styles.disabledBtn]} 
                onPress={() => setTocPage(prev => Math.min(totalTocPages - 1, prev + 1))}
                disabled={tocPage >= totalTocPages - 1}
              >
                <Text style={styles.btnText}>100 Chương tiếp ⏩</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#dc3545', marginTop: 15}]} onPress={() => setShowToc(false)}>
              <Text style={styles.btnText}>Đóng mục lục</Text>
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
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 5, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderTopWidth: 1, borderColor: '#dee2e6' },
  button: { backgroundColor: '#007BFF', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 4 },
  iconButton: { padding: 5 },
  iconText: { fontSize: 20 },
  disabledBtn: { backgroundColor: '#6c757d' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  centerNav: { flex: 1, alignItems: 'center', marginHorizontal: 5 },
  fileTitle: { fontWeight: 'bold', color: '#212529', fontSize: 14, marginBottom: 2 },
  jumpContainer: { flexDirection: 'row', alignItems: 'center' },
  jumpLabel: { fontSize: 12, color: '#495057', marginHorizontal: 3 },
  jumpInput: { borderWidth: 1, borderColor: '#ced4da', borderRadius: 4, width: 45, height: 28, textAlign: 'center', fontSize: 12, backgroundColor: '#fff', padding: 0 },
  goButton: { backgroundColor: '#28a745', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, marginLeft: 5 },
  goBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  contentArea: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center' },
  textContainer: { padding: 20 },
  textContent: { fontSize: 18, lineHeight: 28, color: '#212529', textAlign: 'justify' },
  pdf: { flex: 1, width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  
  // Style cho Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 8, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
  modalSub: { fontSize: 12, color: '#666', marginBottom: 15, textAlign: 'center' },
  settingInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 10, marginBottom: 10, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 15, borderRadius: 4, flex: 1, marginHorizontal: 5 },
  
  // Style cho Mục lục
  tocItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tocItemActive: { backgroundColor: '#e7f1ff' },
  tocText: { fontSize: 16, color: '#333' },
  tocTextActive: { fontWeight: 'bold', color: '#007BFF' },
  tocPagination: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }
});