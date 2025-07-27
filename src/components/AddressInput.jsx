import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

function AddressInput({ passengerPhone }) {
  const [address, setAddress] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!passengerPhone) return;
      const id = passengerPhone.replace(/\D/g, '');
      const ref = doc(db, 'passengers', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setHistory(data.addressHistory || []);
      }
    };
    loadHistory();
  }, [passengerPhone]);

  const handleAddAddress = async () => {
    if (!address) return;
    const id = passengerPhone.replace(/\D/g, '');
    const ref = doc(db, 'passengers', id);
    await updateDoc(ref, {
      addressHistory: arrayUnion(address),
    });
    setHistory((prev) => [address, ...prev]);
    setAddress('');
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Куди їдемо?"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 8 }}
      />
      <button onClick={handleAddAddress}>Зберегти адресу</button>

      {history.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p>Останні адреси:</p>
          <ul>
            {history.map((a, i) => (
              <li key={i} onClick={() => setAddress(a)} style={{ cursor: 'pointer' }}>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AddressInput;
