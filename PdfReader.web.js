import React from 'react';
import { View, Text } from 'react-native';

export default function PdfReader({ style }) {
  return (
    <View style={[{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#e9ecef' }, style]}>
      <Text style={{ padding: 20, textAlign: 'center', color: '#495057' }}>
        [Môi trường Web] Tèo tạm ẩn PDF để không bị lỗi. Anh hai test thử file .txt và các nút lật trang nhé! Khi cài lên điện thoại nó sẽ tự hiện PDF gốc.
      </Text>
    </View>
  );
}