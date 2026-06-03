import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Dimensions, Platform, TextInput } from 'react-native';
import Pdf from './PdfReader';

const API_KEY = 'AIzaSyB-WBOZfXXZgehcn-8TOXG-mlE7pxfqPk8'; 
const FOLDER_ID = '14Uouc776-GmsjpJCgw7SQ3sCN5KFKMCX';

export default function App() {
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [jumpText, setJumpText] = useState('1'); // Lưu con số người dùng gõ vào

  const fetchFiles = async () => {
    try {
      // Gọi API Drive, mặc định Google đã sort name nhưng mình sẽ sort lại cho chắc cốp
      const query = `'${FOLDER_ID}' in parents and (mimeType = 'text/plain' or mimeType = 'application/pdf') and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&orderBy=name&key=${API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        alert("Ê Google báo lỗi nè anh hai: " + data.error.message);
        setLoading(false);
        return;
      }
      
      if (data.files && data.files.length > 0) {
        // Thuật toán sắp xếp A-Z siêu thông minh (Hiểu được số 10 lớn hơn số 2)
        const sortedFiles = data.files.sort((a, b) => 
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        );

        setFiles(sortedFiles);
        setCurrentIndex(0);
        setJumpText('1');
        await loadContent(sortedFiles[0]);
      } else {
        alert("Lạ ghê, Google kêu không thấy file .txt hay .pdf nào trong thư mục này hết!");
        setLoading(false);
      }
    } catch (error) {
      alert("Lỗi rớt mạng hoặc sai cú pháp: " + error.message);
      setLoading(false);
    }
  };

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
      setTextContent(''); 
    }
    setLoadingContent(false);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Xử lý khi anh hai gõ số và bấm nhảy trang
  const handleJump = () => {
    const num = parseInt(jumpText, 10);
    if (!isNaN(num) && num >= 1 && num <= files.length) {
      const newIdx = num - 1;
      if (newIdx !== currentIndex) {
        setCurrentIndex(newIdx);
        loadContent(files[newIdx]);
      }
    } else {
      alert(`Anh hai ơi, nhập số từ 1 đến ${files.length} thôi nha!`);
      // Reset lại đúng số trang hiện tại nếu gõ bậy
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
      
      <View style={styles.centerNav}>
        <Text style={styles.fileTitle} numberOfLines={1}>{currentFile.name}</Text>
        <View style={styles.jumpContainer}>
          <Text style={styles.jumpLabel}>Tệp:</Text>
          <TextInput 
            style={styles.jumpInput}
            keyboardType="numeric"
            value={jumpText}
            onChangeText={setJumpText}
            onSubmitEditing={handleJump}
            onBlur={handleJump}
            returnKeyType="go"
          />
          <Text style={styles.jumpLabel}>/ {files.length}</Text>
        </View>
      </View>
      
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
  button: { backgroundColor: '#007BFF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4 },
  disabledBtn: { backgroundColor: '#6c757d' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  centerNav: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  fileTitle: { fontWeight: 'bold', color: '#212529', fontSize: 14 },
  jumpContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  jumpLabel: { fontSize: 12, color: '#495057' },
  jumpInput: { borderWidth: 1, borderColor: '#ced4da', borderRadius: 4, width: 45, height: 26, textAlign: 'center', marginHorizontal: 5, fontSize: 12, backgroundColor: '#fff', padding: 0 },
  contentArea: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center' },
  textContainer: { padding: 20 },
  textContent: { fontSize: 18, lineHeight: 28, color: '#212529', textAlign: 'justify' },
  pdf: { flex: 1, width: Dimensions.get('window').width, height: Dimensions.get('window').height }
});