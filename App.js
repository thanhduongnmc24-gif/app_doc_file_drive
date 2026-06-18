import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_KEY = 'AIzaSyB-WBOZfXXZgehcn-8TOXG-mlE7pxfqPk8';
const DEFAULT_FOLDER_ID = '1qdFjsfepK500e395iMeyTB8zasDcZtHj';

const MIME_FOLDER = 'application/vnd.google-apps.folder';
const MIME_SHORTCUT = 'application/vnd.google-apps.shortcut';
const MIME_TEXT = 'text/plain';

const CHAPTER_GROUP_SIZE = 50;
const READER_SCROLL_LINES = 5;

const SCREEN_LIBRARY = 'LIBRARY';
const SCREEN_TOC_GROUPS = 'TOC_GROUPS';
const SCREEN_TOC_CHAPTERS = 'TOC_CHAPTERS';
const SCREEN_READER = 'READER';

export default function App() {
  const [apiKey] = useState(DEFAULT_API_KEY);
  const [folderId] = useState(DEFAULT_FOLDER_ID);

  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Đang khởi động...');
  const [loadingContent, setLoadingContent] = useState(false);

  const [screen, setScreen] = useState(SCREEN_LIBRARY);

  const [folderStack, setFolderStack] = useState([]);
  const [localTree, setLocalTree] = useState({});

  const [currentItems, setCurrentItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [currentBook, setCurrentBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);

  const [textContent, setTextContent] = useState('');
  const [fontSize, setFontSize] = useState(18);
  const [readerFooterVisible, setReaderFooterVisible] = useState(true);

  const [showJumpModal, setShowJumpModal] = useState(false);
  const [jumpText, setJumpText] = useState('1');

  const scrollViewRef = useRef(null);
  const scrollY = useRef(0);
  const hiddenInputRef = useRef(null);
  const keyboardBlockTimerRef = useRef(null);

  const contentCacheRef = useRef({});
  const prefetchingRef = useRef({});

  const focusHiddenInput = () => {
    if (showJumpModal) return;

    hiddenInputRef.current?.focus();

    setTimeout(() => {
      Keyboard.dismiss();
    }, 30);
  };

  const hardDismissKeyboard = () => {
    if (showJumpModal) return;

    Keyboard.dismiss();

    if (keyboardBlockTimerRef.current) {
      clearTimeout(keyboardBlockTimerRef.current);
    }

    keyboardBlockTimerRef.current = setTimeout(() => {
      Keyboard.dismiss();
      hiddenInputRef.current?.focus();
    }, 80);
  };

  useEffect(() => {
    loadInitialSettings();

    return () => {
      if (keyboardBlockTimerRef.current) {
        clearTimeout(keyboardBlockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showJumpModal) return;

    const timer = setTimeout(() => {
      focusHiddenInput();
    }, 250);

    return () => clearTimeout(timer);
  }, [
    screen,
    loading,
    loadingContent,
    selectedIndex,
    selectedGroupIndex,
    selectedChapterIndex,
    currentChapterIndex,
    showJumpModal,
  ]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      if (!showJumpModal) {
        Keyboard.dismiss();

        setTimeout(() => {
          hiddenInputRef.current?.focus();
        }, 80);
      }
    });

    return () => {
      showSub.remove();
    };
  }, [showJumpModal]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackSmart();
      return true;
    });

    return () => sub.remove();
  }, [
    screen,
    folderStack,
    currentBook,
    chapters,
    currentChapterIndex,
    selectedGroupIndex,
    showJumpModal,
  ]);

  const fetchContents = async (fId, key, foldersOnly = false) => {
    let allItems = [];
    let pageToken = '';

    do {
      const query = foldersOnly
        ? `'${fId}' in parents and trashed = false and (mimeType = '${MIME_FOLDER}' or mimeType = '${MIME_SHORTCUT}')`
        : `'${fId}' in parents and trashed = false`;

      let url =
        'https://www.googleapis.com/drive/v3/files' +
        `?q=${encodeURIComponent(query)}` +
        '&fields=nextPageToken,files(id,name,mimeType,shortcutDetails)' +
        '&orderBy=name' +
        '&pageSize=1000' +
        `&key=${key}`;

      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message || 'Lỗi Google Drive API');
      }

      if (data.files) {
        allItems = allItems.concat(data.files);
      }

      pageToken = data.nextPageToken || '';
    } while (pageToken);

    const folders = allItems
      .filter((item) => item.mimeType === MIME_FOLDER || item.mimeType === MIME_SHORTCUT)
      .map((item) => {
        if (item.mimeType === MIME_SHORTCUT && item.shortcutDetails) {
          return {
            id: item.shortcutDetails.targetId,
            name: item.name,
            mimeType: item.shortcutDetails.targetMimeType || MIME_FOLDER,
          };
        }

        return {
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
        };
      })
      .filter((item) => item.id)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const txtFiles = foldersOnly
      ? []
      : allItems
          .filter((item) => {
            const name = item.name.toLowerCase();
            return item.mimeType === MIME_TEXT || name.endsWith('.txt');
          })
          .map((item) => ({
            id: item.id,
            name: item.name,
            mimeType: item.mimeType,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    if (txtFiles.length > 0) {
      return {
        type: 'story',
        folders,
        files: txtFiles,
      };
    }

    return {
      type: 'folders',
      folders,
      files: [],
    };
  };

  const loadInitialSettings = async () => {
    setLoading(true);
    setLoadingText('Đang mở Tàng Kinh Các...');

    try {
      const savedFontSize = await AsyncStorage.getItem('customFontSize');

      if (savedFontSize) {
        const parsed = parseInt(savedFontSize, 10);
        if (!Number.isNaN(parsed)) {
          setFontSize(parsed);
        }
      }

      setFolderStack([{ id: folderId, name: '📚 Tàng Kinh Các' }]);

      const cacheKey = `lazyTree_${folderId}`;
      const savedTree = await AsyncStorage.getItem(cacheKey);
      let treeData = savedTree ? JSON.parse(savedTree) : {};

      if (!treeData[folderId]) {
        const result = await fetchContents(folderId, apiKey, true);

        treeData[folderId] = {
          type: 'folders',
          folders: result.folders || [],
          files: [],
          name: '📚 Tàng Kinh Các',
        };

        await AsyncStorage.setItem(cacheKey, JSON.stringify(treeData));
      }

      setLocalTree(treeData);
      setCurrentItems(treeData[folderId]?.folders || []);
      setSelectedIndex(0);
      setScreen(SCREEN_LIBRARY);
    } catch (e) {
      alert('Lỗi khởi tạo: ' + e.message);
    }

    setLoading(false);
  };

  const saveTree = async (newTree) => {
    setLocalTree(newTree);
    await AsyncStorage.setItem(`lazyTree_${folderId}`, JSON.stringify(newTree));
  };

  const openFolder = async (item) => {
    if (!item) return;

    const cachedNode = localTree[item.id];

    if (cachedNode) {
      openNodeFromCache(item, cachedNode);
      return;
    }

    setLoading(true);
    setLoadingText(`Đang mở ${item.name}...`);

    try {
      const result = await fetchContents(item.id, apiKey, false);

      const updatedTree = {
        ...localTree,
        [item.id]: {
          type: result.type,
          folders: result.folders || [],
          files: result.files || [],
          name: item.name,
        },
      };

      await saveTree(updatedTree);
      openNodeFromCache(item, updatedTree[item.id]);
    } catch (e) {
      alert('Lỗi tải mục: ' + e.message);
    }

    setLoading(false);
  };

  const openNodeFromCache = async (item, node) => {
    if (node.type === 'story') {
      const storyFiles = node.files || [];

      contentCacheRef.current = {};
      prefetchingRef.current = {};

      setCurrentBook({ id: item.id, name: item.name });
      setChapters(storyFiles);
      setTextContent('');

      const savedIndexRaw = await AsyncStorage.getItem(`lastRead_${item.id}`);
      let savedIndex = parseInt(savedIndexRaw || '0', 10);

      if (Number.isNaN(savedIndex)) {
        savedIndex = 0;
      }

      savedIndex = Math.max(0, Math.min(savedIndex, storyFiles.length - 1));

      setCurrentChapterIndex(savedIndex);
      setSelectedGroupIndex(getGroupIndexForChapter(savedIndex));
      setSelectedIndex(getGroupIndexForChapter(savedIndex));
      setSelectedChapterIndex(savedIndex);
      setJumpText(String(savedIndex + 1));
      setScreen(SCREEN_TOC_GROUPS);

      prefetchChapterByIndex(savedIndex, storyFiles);
      prefetchChapterByIndex(savedIndex + 1, storyFiles);

      return;
    }

    setFolderStack((prev) => [...prev, { id: item.id, name: item.name }]);
    setCurrentItems(node.folders || []);
    setSelectedIndex(0);
    setScreen(SCREEN_LIBRARY);
  };

  const refreshCurrent = async () => {
    setLoading(true);

    try {
      if (currentBook) {
        setLoadingText(`Đang tải lại ${currentBook.name}...`);

        const result = await fetchContents(currentBook.id, apiKey, false);

        const updatedTree = {
          ...localTree,
          [currentBook.id]: {
            type: result.type,
            folders: result.folders || [],
            files: result.files || [],
            name: currentBook.name,
          },
        };

        await saveTree(updatedTree);

        contentCacheRef.current = {};
        prefetchingRef.current = {};

        const newFiles = result.files || [];
        setChapters(newFiles);

        const safeIndex = Math.min(currentChapterIndex, Math.max(0, newFiles.length - 1));

        setCurrentChapterIndex(safeIndex);
        setSelectedGroupIndex(getGroupIndexForChapter(safeIndex));
        setSelectedIndex(getGroupIndexForChapter(safeIndex));
        setSelectedChapterIndex(safeIndex);
        setScreen(SCREEN_TOC_GROUPS);

        prefetchChapterByIndex(safeIndex, newFiles);
        prefetchChapterByIndex(safeIndex + 1, newFiles);
      } else {
        const currentFolder = folderStack[folderStack.length - 1] || {
          id: folderId,
          name: '📚 Tàng Kinh Các',
        };

        const isRoot = currentFolder.id === folderId;
        setLoadingText(`Đang tải lại ${currentFolder.name}...`);

        const result = await fetchContents(currentFolder.id, apiKey, isRoot);

        const updatedTree = {
          ...localTree,
          [currentFolder.id]: {
            type: isRoot ? 'folders' : result.type,
            folders: result.folders || [],
            files: isRoot ? [] : result.files || [],
            name: currentFolder.name,
          },
        };

        await saveTree(updatedTree);
        setCurrentItems(updatedTree[currentFolder.id].folders || []);
        setSelectedIndex(0);
        setScreen(SCREEN_LIBRARY);
      }
    } catch (e) {
      alert('Lỗi tải lại: ' + e.message);
    }

    setLoading(false);
  };

  const downloadChapterText = async (file) => {
    if (!file) return '';

    const cached = contentCacheRef.current[file.id];

    if (typeof cached === 'string') {
      return cached;
    }

    const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Lỗi tải chương');
    }

    const text = await response.text();
    contentCacheRef.current[file.id] = text;

    return text;
  };

  const prefetchChapterByIndex = async (index, chapterList = chapters) => {
    if (index < 0 || index >= chapterList.length) return;

    const file = chapterList[index];
    if (!file) return;

    if (typeof contentCacheRef.current[file.id] === 'string') return;
    if (prefetchingRef.current[file.id]) return;

    prefetchingRef.current[file.id] = true;

    try {
      const text = await downloadChapterText(file);
      contentCacheRef.current[file.id] = text;
    } catch (e) {
      // Prefetch lỗi thì bỏ qua, khi mở chương sẽ tải lại.
    } finally {
      delete prefetchingRef.current[file.id];
    }
  };

  const loadContent = async (file, index) => {
    if (!file) return;

    scrollY.current = 0;
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });

    const cached = contentCacheRef.current[file.id];

    if (typeof cached === 'string') {
      setLoadingContent(false);
      setTextContent(cached);

      if (currentBook) {
        await AsyncStorage.setItem(`lastRead_${currentBook.id}`, String(index));
      }

      prefetchChapterByIndex(index + 1);
      return;
    }

    setLoadingContent(true);
    setTextContent('');

    try {
      const text = await downloadChapterText(file);
      setTextContent(text);

      if (currentBook) {
        await AsyncStorage.setItem(`lastRead_${currentBook.id}`, String(index));
      }

      prefetchChapterByIndex(index + 1);
    } catch (e) {
      setTextContent('Lỗi tải chương:\n' + e.message);
    }

    setLoadingContent(false);
  };

  const openChapter = async (index) => {
    if (index < 0 || index >= chapters.length) return;

    const file = chapters[index];
    const cached = file ? contentCacheRef.current[file.id] : null;

    setScreen(SCREEN_READER);
    setCurrentChapterIndex(index);
    setSelectedChapterIndex(index);
    setSelectedGroupIndex(getGroupIndexForChapter(index));
    setJumpText(String(index + 1));
    setReaderFooterVisible(true);

    if (typeof cached === 'string') {
      setLoadingContent(false);
      setTextContent(cached);
      scrollY.current = 0;
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      if (currentBook) {
        await AsyncStorage.setItem(`lastRead_${currentBook.id}`, String(index));
      }

      prefetchChapterByIndex(index + 1);
      return;
    }

    await loadContent(file, index);
  };

  const previousChapter = () => {
    if (screen !== SCREEN_READER) return;

    if (currentChapterIndex > 0) {
      openChapter(currentChapterIndex - 1);
    }
  };

  const nextChapter = () => {
    if (screen !== SCREEN_READER) return;

    if (currentChapterIndex < chapters.length - 1) {
      openChapter(currentChapterIndex + 1);
    }
  };

  const changeFontSize = async (delta) => {
    if (screen !== SCREEN_READER) return;

    const newSize = Math.max(12, Math.min(50, fontSize + delta));
    setFontSize(newSize);

    await AsyncStorage.setItem('customFontSize', String(newSize));
  };

  const showJump = () => {
    if (chapters.length === 0) return;

    setJumpText(String(currentChapterIndex + 1));
    setShowJumpModal(true);
  };

  const handleJump = () => {
    const num = parseInt(jumpText, 10);

    if (Number.isNaN(num) || num < 1 || num > chapters.length) {
      alert(`Nhập số từ 1 đến ${chapters.length}`);
      return;
    }

    setShowJumpModal(false);
    openChapter(num - 1);
  };

  const getGroupCount = () => {
    if (chapters.length === 0) return 0;

    return Math.ceil(chapters.length / CHAPTER_GROUP_SIZE);
  };

  function getGroupIndexForChapter(chapterIndex) {
    if (chapterIndex < 0) return 0;

    return Math.floor(chapterIndex / CHAPTER_GROUP_SIZE);
  }

  const getGroupStartIndex = (groupIndex) => {
    return groupIndex * CHAPTER_GROUP_SIZE;
  };

  const getGroupEndIndex = (groupIndex) => {
    const rawEnd = getGroupStartIndex(groupIndex) + CHAPTER_GROUP_SIZE - 1;
    return Math.min(rawEnd, chapters.length - 1);
  };

  const openSelected = () => {
    if (screen === SCREEN_LIBRARY) {
      const item = currentItems[selectedIndex];
      openFolder(item);
      return;
    }

    if (screen === SCREEN_TOC_GROUPS) {
      const groupCount = getGroupCount();
      if (groupCount <= 0) return;

      const groupIndex = Math.max(0, Math.min(selectedIndex, groupCount - 1));
      const start = getGroupStartIndex(groupIndex);
      const end = getGroupEndIndex(groupIndex);

      setSelectedGroupIndex(groupIndex);

      if (currentChapterIndex >= start && currentChapterIndex <= end) {
        setSelectedChapterIndex(currentChapterIndex);
      } else {
        setSelectedChapterIndex(start);
      }

      setScreen(SCREEN_TOC_CHAPTERS);
      return;
    }

    if (screen === SCREEN_TOC_CHAPTERS) {
      openChapter(selectedChapterIndex);
      return;
    }

    if (screen === SCREEN_READER) {
      const groupIndex = getGroupIndexForChapter(currentChapterIndex);
      setSelectedGroupIndex(groupIndex);
      setSelectedIndex(groupIndex);
      setScreen(SCREEN_TOC_GROUPS);
    }
  };

  const moveSelection = (delta) => {
    if (screen === SCREEN_LIBRARY) {
      if (currentItems.length === 0) return;

      setSelectedIndex((prev) => Math.max(0, Math.min(prev + delta, currentItems.length - 1)));
      return;
    }

    if (screen === SCREEN_TOC_GROUPS) {
      const groupCount = getGroupCount();
      if (groupCount <= 0) return;

      setSelectedIndex((prev) => {
        const next = Math.max(0, Math.min(prev + delta, groupCount - 1));
        setSelectedGroupIndex(next);
        return next;
      });

      return;
    }

    if (screen === SCREEN_TOC_CHAPTERS) {
      const start = getGroupStartIndex(selectedGroupIndex);
      const end = getGroupEndIndex(selectedGroupIndex);

      setSelectedChapterIndex((prev) => Math.max(start, Math.min(prev + delta, end)));
      return;
    }

    if (screen === SCREEN_READER) {
      const lineHeight = fontSize * 1.6;
      const amount = lineHeight * READER_SCROLL_LINES;
      const nextOffset = Math.max(0, scrollY.current + amount * delta);

      scrollViewRef.current?.scrollTo({ y: nextOffset, animated: true });
    }
  };

  const previousGroup = () => {
    if (screen !== SCREEN_TOC_CHAPTERS) return;

    if (selectedGroupIndex > 0) {
      const newGroup = selectedGroupIndex - 1;
      setSelectedGroupIndex(newGroup);
      setSelectedChapterIndex(getGroupStartIndex(newGroup));
    }
  };

  const nextGroup = () => {
    if (screen !== SCREEN_TOC_CHAPTERS) return;

    const groupCount = getGroupCount();

    if (selectedGroupIndex < groupCount - 1) {
      const newGroup = selectedGroupIndex + 1;
      setSelectedGroupIndex(newGroup);
      setSelectedChapterIndex(getGroupStartIndex(newGroup));
    }
  };

  const goBackSmart = () => {
    if (showJumpModal) {
      setShowJumpModal(false);
      return;
    }

    if (screen === SCREEN_READER) {
      const groupIndex = getGroupIndexForChapter(currentChapterIndex);
      setSelectedGroupIndex(groupIndex);
      setSelectedChapterIndex(currentChapterIndex);
      setScreen(SCREEN_TOC_CHAPTERS);
      return;
    }

    if (screen === SCREEN_TOC_CHAPTERS) {
      setSelectedIndex(selectedGroupIndex);
      setScreen(SCREEN_TOC_GROUPS);
      return;
    }

    if (screen === SCREEN_TOC_GROUPS) {
      setCurrentBook(null);
      setChapters([]);
      setTextContent('');
      setSelectedGroupIndex(0);
      setSelectedChapterIndex(0);

      contentCacheRef.current = {};
      prefetchingRef.current = {};

      if (folderStack.length > 1) {
        const newStack = folderStack.slice(0, -1);
        setFolderStack(newStack);

        const parent = newStack[newStack.length - 1];
        const parentNode = localTree[parent.id] || { folders: [] };

        setCurrentItems(parentNode.folders || []);
        setSelectedIndex(0);
        setScreen(SCREEN_LIBRARY);
      } else {
        setCurrentItems(localTree[folderId]?.folders || []);
        setSelectedIndex(0);
        setScreen(SCREEN_LIBRARY);
      }

      return;
    }

    if (screen === SCREEN_LIBRARY) {
      if (folderStack.length > 1) {
        const newStack = folderStack.slice(0, -1);
        setFolderStack(newStack);

        const parent = newStack[newStack.length - 1];
        const parentNode = localTree[parent.id] || { folders: [] };

        setCurrentItems(parentNode.folders || []);
        setSelectedIndex(0);
      } else {
        BackHandler.exitApp();
      }
    }
  };

  const handleKeyPress = (e) => {
    const key = e.nativeEvent.key;

    hardDismissKeyboard();

    if (key === '2' || key === 'ArrowUp' || key === 'DPadUp') {
      moveSelection(-1);
      return;
    }

    if (key === '8' || key === 'ArrowDown' || key === 'DPadDown') {
      moveSelection(1);
      return;
    }

    if (key === '5' || key === 'Enter') {
      openSelected();
      return;
    }

    if (key === '0' || key === 'Backspace' || key === 'Escape') {
      goBackSmart();
      return;
    }

    if (key === '1') {
      previousChapter();
      return;
    }

    if (key === '3') {
      nextChapter();
      return;
    }

    if (key === '4') {
      if (screen === SCREEN_READER) changeFontSize(-2);
      if (screen === SCREEN_TOC_CHAPTERS) previousGroup();
      return;
    }

    if (key === '6') {
      if (screen === SCREEN_READER) changeFontSize(2);
      else if (screen === SCREEN_TOC_CHAPTERS) nextGroup();
      else refreshCurrent();
      return;
    }

    if (key === '7') {
      showJump();
      return;
    }

    if (key === '9') {
      if (screen === SCREEN_READER) {
        setReaderFooterVisible((prev) => !prev);
      }
    }
  };

  const handleScroll = (event) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  };

  const renderHiddenInput = () => {
    return (
      <TextInput
        ref={hiddenInputRef}
        style={styles.hiddenInput}
        autoFocus={false}
        focusable={true}
        showSoftInputOnFocus={false}
        caretHidden={true}
        contextMenuHidden={true}
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
        importantForAutofill="no"
        blurOnSubmit={false}
        inputMode="none"
        onFocus={hardDismissKeyboard}
        onPressIn={hardDismissKeyboard}
        onKeyPress={handleKeyPress}
        value=""
        onChangeText={() => {
          hardDismissKeyboard();
        }}
      />
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHiddenInput()}

        <View style={styles.center}>
          <ActivityIndicator size="large" color="#333333" />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentFolderName = folderStack[folderStack.length - 1]?.name || '📚 Tàng Kinh Các';

  return (
    <SafeAreaView style={styles.container}>
      {renderHiddenInput()}

      {screen === SCREEN_LIBRARY && (
        <LibraryScreen
          title={currentFolderName}
          items={currentItems}
          selectedIndex={selectedIndex}
          onPressItem={(item, index) => {
            setSelectedIndex(index);
            openFolder(item);
          }}
          onRefresh={refreshCurrent}
          onBack={goBackSmart}
        />
      )}

      {screen === SCREEN_TOC_GROUPS && (
        <TocGroupsScreen
          bookName={currentBook?.name || 'Mục lục'}
          groupCount={getGroupCount()}
          selectedIndex={selectedIndex}
          getGroupStartIndex={getGroupStartIndex}
          getGroupEndIndex={getGroupEndIndex}
          onPressGroup={(groupIndex) => {
            setSelectedIndex(groupIndex);
            setSelectedGroupIndex(groupIndex);

            const start = getGroupStartIndex(groupIndex);
            const end = getGroupEndIndex(groupIndex);

            if (currentChapterIndex >= start && currentChapterIndex <= end) {
              setSelectedChapterIndex(currentChapterIndex);
            } else {
              setSelectedChapterIndex(start);
            }

            setScreen(SCREEN_TOC_CHAPTERS);
          }}
          onRefresh={refreshCurrent}
          onBack={goBackSmart}
        />
      )}

      {screen === SCREEN_TOC_CHAPTERS && (
        <TocChaptersScreen
          bookName={currentBook?.name || 'Mục lục'}
          chapters={chapters}
          selectedGroupIndex={selectedGroupIndex}
          selectedChapterIndex={selectedChapterIndex}
          getGroupStartIndex={getGroupStartIndex}
          getGroupEndIndex={getGroupEndIndex}
          onPressChapter={(chapterIndex) => {
            setSelectedChapterIndex(chapterIndex);
            openChapter(chapterIndex);
          }}
          onBack={goBackSmart}
        />
      )}

      {screen === SCREEN_READER && (
        <ReaderScreen
          textContent={textContent}
          fontSize={fontSize}
          loadingContent={loadingContent}
          scrollViewRef={scrollViewRef}
          handleScroll={handleScroll}
          footerVisible={readerFooterVisible}
        />
      )}

      <JumpModal
        visible={showJumpModal}
        jumpText={jumpText}
        setJumpText={setJumpText}
        max={chapters.length}
        onCancel={() => {
          setShowJumpModal(false);

          setTimeout(() => {
            focusHiddenInput();
          }, 150);
        }}
        onGo={handleJump}
      />
    </SafeAreaView>
  );
}

function LibraryScreen({ title, items, selectedIndex, onPressItem, onRefresh, onBack }) {
  return (
    <View style={styles.screen}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>

        <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Mục này trống hoặc không có folder/truyện .txt</Text>
        }
        renderItem={({ item, index }) => {
          const active = index === selectedIndex;

          return (
            <TouchableOpacity
              style={[styles.rowItem, active && styles.rowItemActive]}
              onPress={() => onPressItem(item, index)}
            >
              <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={2}>
                {active ? '➤ ' : '   '}📁 {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <Footer text="2/8 chọn · 5 mở · 0 lại · 6 tải" />
    </View>
  );
}

function TocGroupsScreen({
  bookName,
  groupCount,
  selectedIndex,
  getGroupStartIndex,
  getGroupEndIndex,
  onPressGroup,
  onRefresh,
  onBack,
}) {
  const groups = Array.from({ length: groupCount }, (_, index) => index);

  return (
    <View style={styles.screen}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {bookName} - Cụm chương
        </Text>

        <TouchableOpacity onPress={onRefresh} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>↻</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => String(item)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>Không có chương .txt</Text>}
        renderItem={({ item }) => {
          const start = getGroupStartIndex(item) + 1;
          const end = getGroupEndIndex(item) + 1;
          const active = item === selectedIndex;

          return (
            <TouchableOpacity
              style={[styles.rowItem, active && styles.rowItemActive]}
              onPress={() => onPressGroup(item)}
            >
              <Text style={[styles.rowText, active && styles.rowTextActive]}>
                {active ? '➤ ' : '   '}📚 Chương {start} - {end}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <Footer text="2/8 cụm · 5 mở · 7 nhảy · 0 lại · 6 tải" />
    </View>
  );
}

function TocChaptersScreen({
  bookName,
  chapters,
  selectedGroupIndex,
  selectedChapterIndex,
  getGroupStartIndex,
  getGroupEndIndex,
  onPressChapter,
  onBack,
}) {
  const start = getGroupStartIndex(selectedGroupIndex);
  const end = getGroupEndIndex(selectedGroupIndex);
  const groupChapters = chapters.slice(start, end + 1);

  return (
    <View style={styles.screen}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {bookName} - {start + 1} đến {end + 1}
        </Text>
      </View>

      <FlatList
        data={groupChapters}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const globalIndex = start + index;
          const active = globalIndex === selectedChapterIndex;

          return (
            <TouchableOpacity
              style={[styles.rowItem, active && styles.rowItemActive]}
              onPress={() => onPressChapter(globalIndex)}
            >
              <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={2}>
                {active ? '➤ ' : '   '}
                {globalIndex + 1}. {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <Footer text="2/8 chọn · 5 đọc · 4/6 cụm · 7 nhảy · 0 lại" />
    </View>
  );
}

function ReaderScreen({
  textContent,
  fontSize,
  loadingContent,
  scrollViewRef,
  handleScroll,
  footerVisible,
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.readerArea}>
        {loadingContent ? (
          <ActivityIndicator size="large" color="#333333" />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.textContainer}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <Text
              style={[
                styles.textContent,
                {
                  fontSize,
                  lineHeight: fontSize * 1.6,
                },
              ]}
            >
              {textContent}
            </Text>
          </ScrollView>
        )}
      </View>

      {footerVisible ? (
        <Footer text="1/3 chương · 2/8 cuộn · 4/6 font · 5 ML · 7 nhảy · 9 ẩn · 0 lại" />
      ) : (
        <View style={styles.footerHidden} />
      )}
    </View>
  );
}

function JumpModal({ visible, jumpText, setJumpText, max, onCancel, onGo }) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.jumpBox}>
          <Text style={styles.jumpTitle}>Nhảy tới chương</Text>
          <Text style={styles.jumpHint}>Nhập số từ 1 đến {max}</Text>

          <TextInput
            style={styles.jumpInputLarge}
            keyboardType="numeric"
            value={jumpText}
            onChangeText={setJumpText}
            autoFocus={true}
            selectTextOnFocus={true}
            showSoftInputOnFocus={true}
          />

          <View style={styles.jumpActions}>
            <TouchableOpacity style={[styles.jumpButton, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.jumpButtonText}>Huỷ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.jumpButton, styles.goButton]} onPress={onGo}>
              <Text style={styles.jumpButtonText}>Đi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Footer({ text }) {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -10,
    left: -10,
    zIndex: -1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#555555',
    fontSize: 14,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    backgroundColor: '#f8f8f8',
  },
  headerButton: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    fontSize: 20,
    color: '#333333',
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222222',
  },
  listContent: {
    paddingBottom: 8,
  },
  rowItem: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
    backgroundColor: '#ffffff',
  },
  rowItemActive: {
    backgroundColor: '#e7f1ff',
  },
  rowText: {
    fontSize: 15,
    color: '#222222',
  },
  rowTextActive: {
    color: '#0057c2',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#777777',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  readerArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textContent: {
    color: '#111111',
    textAlign: 'justify',
  },
  footer: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    backgroundColor: '#fafafa',
  },
  footerText: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'center',
  },
  footerHidden: {
    height: 1,
    backgroundColor: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBox: {
    width: '86%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
  },
  jumpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
    color: '#222222',
  },
  jumpHint: {
    fontSize: 13,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 10,
  },
  jumpInputLarge: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  jumpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  jumpButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#777777',
  },
  goButton: {
    backgroundColor: '#007bff',
  },
  jumpButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});