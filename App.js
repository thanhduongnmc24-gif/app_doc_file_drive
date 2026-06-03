import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Dimensions } from 'react-native';
import Pdf from 'react-native-pdf';

// Điền thông tin API Key và Thư mục bí mật của anh hai vào đây nhé!
const API_KEY = 'CHO_NAY_DIEN_API_KEY_CUA_ANH_HAI';
const FOLDER_ID = 'CHO_NAY_DIEN_FOLDER_ID_CUA_ANH_HAI';

export default function App() {
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  // Tải danh sách các file .txt và .pdf từ thư mục chỉ định
  const fetchFiles = async () => {
    try {
      const query = `'${FOLDER_ID}' in parents and (mimeType = 'text/plain' or mimeType = 'application/pdf') and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=name&key=${API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
        setCurrentIndex(0);
        await loadContent(data.files[0]);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Lỗi lấy danh sách file từ Drive:", error);
      setLoading(false);
    }
  };

  // Hàm tải dữ liệu text nếu là file .txt
  const loadContent = async (file) => {
    if (!file) return;
    setLoadingContent(true);
    if (file.mimeType === 'text/plain') {
      try {
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${API_KEY}`;
        const response = await fetch(url);
        const text = await response.text();
        setTextContent(text);
      } catch (error) {
        setTextContent("Lỗi tải nội dung file văn bản.");
      }
    } else {
      setTextContent(''); // Để trống để Viewer PDF tự kích hoạt
    }
    setLoadingContent(false);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleNext = async () => {
    if (currentIndex < files.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      await loadContent(files[nextIdx]);
    }
  };

  const handlePrev = async () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      await loadContent(files[prevIdx]);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={{ marginTop: 10, color: '#555' }}>Tèo đang tải danh sách tài liệu...</Text>
      </View>
    );
  }

  if (files.length === 0) {
    return (
      <View style={styles.center}>
        <Text>Thư mục trống hoặc chưa có file .txt / .pdf nào anh hai ơi!</Text>
      </View>
    );
  }

  const currentFile = files[currentIndex];

  const NavigationButtons = () => (
    <View style={styles.navBar}>
      <TouchableOpacity 
        style={[styles.button, currentIndex === 0 && styles.disabledBtn]} 
        onPress={handlePrev} 
        disabled={currentIndex === 0}
      >
        <Text style={styles.btnText}>Trang trước</Text>
      </TouchableOpacity>
      
      <Text style={styles.fileTitle} numberOfLines={1}>{currentFile.name}</Text>
      
      <TouchableOpacity 
        style={[styles.button, currentIndex === files.length - 1 && styles.disabledBtn]} 
        onPress={handleNext} 
        disabled={currentIndex === files.length - 1}
      >
        <Text style={styles.btnText}>Trang tiếp</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <NavigationButtons />
      
      <View style={styles.contentArea}>
        {loadingContent ? (
          <ActivityIndicator size="large" color="#007BFF" />
        ) : currentFile.mimeType === 'text/plain' ? (
          <ScrollView style={styles.textContainer}>
            <Text style={styles.textContent}>{textContent}</Text>
          </ScrollView>
        ) : (
          <Pdf
            source={{ uri: `https://www.googleapis.com/drive/v3/files/${currentFile.id}?alt=media&key=${API_KEY}` }}
            style={styles.pdf}
            onError={(error) => console.log("Lỗi render file PDF:", error)}
          />
        )}
      </View>

      <NavigationButtons />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderTopWidth: 1, borderColor: '#dee2e6' },
  button: { backgroundColor: '#007BFF', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4 },
  disabledBtn: { backgroundColor: '#6c757d' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  fileTitle: { flex: 1, textAlign: 'center', marginHorizontal: 10, fontWeight: 'bold', color: '#212529' },
  contentArea: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center' },
  textContainer: { padding: 20 },
  textContent: { fontSize: 18, lineHeight: 28, color: '#212529', textAlign: 'justify' },
  pdf: { flex: 1, width: Dimensions.get('window').width, height: Dimensions.get('window').height }
});