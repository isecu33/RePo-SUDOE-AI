#!/usr/bin/env python
"""
Compilador de mensajes .po a .mo sin depender de GNU gettext
Usa la biblioteca estándar de Python
"""
import os
import re
from pathlib import Path

def parse_po_file(po_path):
    """
    Parsea un archivo .po y retorna un diccionario de traducciones
    """
    messages = {}
    
    with open(po_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Encontrar todos los pares msgid/msgstr
    pattern = r'msgid\s+"([^"\\]*(\\.[^"\\]*)*)"\s+msgstr\s+"([^"\\]*(\\.[^"\\]*)*)\"'
    
    for match in re.finditer(pattern, content, re.MULTILINE):
        msgid = match.group(1).replace('\\"', '"').replace('\\n', '\n')
        msgstr = match.group(3).replace('\\"', '"').replace('\\n', '\n')
        
        if msgid:  # Skip empty msgid (metadata)
            messages[msgid] = msgstr
    
    return messages

def compile_mo(po_path, mo_path):
    """
    Compila un archivo .po a .mo
    """
    try:
        messages = parse_po_file(po_path)
        
        # Crear archivo .mo en formato binario
        # Estructura MO: magic number + offsets + datos
        
        # Sorted keys para consistencia
        keys = sorted(m for m in messages.keys() if m)
        
        # Construir bloque de IDs y valores
        ids_data = b''
        strs_data = b''
        id_offsets = []
        str_offsets = []
        
        for key in keys:
            key_bytes = key.encode('utf-8')
            str_bytes = messages[key].encode('utf-8')
            
            id_offsets.append((len(ids_data), len(key_bytes)))
            str_offsets.append((len(strs_data), len(str_bytes)))
            
            ids_data += key_bytes
            strs_data += str_bytes
        
        # Crear archivo MO
        import struct
        
        # Magic number para MO (little-endian)
        magic = 0xde120495
        
        # Metadata del archivo
        num_strings = len(keys)
        master_index_offset = 28  # Después del header
        trans_index_offset = master_index_offset + (8 * num_strings)
        ids_offset = trans_index_offset + (8 * num_strings)
        strs_offset = ids_offset + len(ids_data)
        
        # Escribir header
        with open(mo_path, 'wb') as f:
            f.write(struct.pack('I', magic))  # Magic
            f.write(struct.pack('I', 0))      # Version
            f.write(struct.pack('I', num_strings))  # Número de strings
            f.write(struct.pack('I', master_index_offset))  # Offset tabla original
            f.write(struct.pack('I', trans_index_offset))   # Offset tabla traducida
            f.write(struct.pack('I', 0))      # Hash table size
            f.write(struct.pack('I', 0))      # Hash table offset
            
            # Tabla de índices para IDs originales
            for offset, length in id_offsets:
                f.write(struct.pack('I', length))
                f.write(struct.pack('I', ids_offset + offset))
            
            # Tabla de índices para strings traducidos
            for offset, length in str_offsets:
                f.write(struct.pack('I', length))
                f.write(struct.pack('I', strs_offset + offset))
            
            # Datos de IDs
            f.write(ids_data)
            
            # Datos de strings traducidos
            f.write(strs_data)
        
        print(f"✓ {po_path.name} → {mo_path.name} ({len(keys)} mensajes)")
        return True
        
    except Exception as e:
        print(f"✗ Error compilando {po_path}: {e}")
        return False

def main():
    """
    Compila todos los archivos .po en el directorio locale
    """
    locale_dir = Path(__file__).parent / 'locale'
    
    if not locale_dir.exists():
        print(f"Error: No se encuentra directorio {locale_dir}")
        return
    
    total = 0
    success = 0
    
    for lang_dir in sorted(locale_dir.iterdir()):
        if not lang_dir.is_dir() or lang_dir.name.startswith('.'):
            continue
        
        lc_messages = lang_dir / 'LC_MESSAGES'
        if not lc_messages.exists():
            continue
        
        po_file = lc_messages / 'django.po'
        mo_file = lc_messages / 'django.mo'
        
        if po_file.exists():
            total += 1
            if compile_mo(po_file, mo_file):
                success += 1
    
    print(f"\n{'='*50}")
    print(f"Resultado: {success}/{total} idiomas compilados exitosamente")
    print(f"{'='*50}")

if __name__ == '__main__':
    main()
