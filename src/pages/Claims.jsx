import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { AlertCircle } from 'lucide-react';

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchClaims();
  }, []);

  async function fetchClaims() {
    // Fetch pending claims and join with bilty info
    const { data, error } = await supabase
      .from('short_claims')
      .select(`
        *,
        bilties ( bilty_number, description )
      `)
      .eq('status', 'pending');

    if (data) setClaims(data);
  }

  const handleResolve = async (claim, resolution) => {
    setMessage('');
    try {
      if (resolution === 'solved') {
        // If solved, it means the short items were found/recovered.
        // We must add them to the branch inventory (by updating receiving_verifications).
        
        // 1. Fetch current verification
        const { data: verData, error: verErr } = await supabase
          .from('receiving_verifications')
          .select('received_qty, short_qty')
          .eq('id', claim.receiving_verification_id)
          .single();
          
        if (verErr) throw verErr;

        // 2. Update verification
        const newReceived = verData.received_qty + claim.short_qty;
        const newShort = verData.short_qty - claim.short_qty; // usually becomes 0

        const { error: updateVerErr } = await supabase
          .from('receiving_verifications')
          .update({ received_qty: newReceived, short_qty: newShort })
          .eq('id', claim.receiving_verification_id);

        if (updateVerErr) throw updateVerErr;
      }

      // Update claim status (either solved or deleted)
      const { error: claimErr } = await supabase
        .from('short_claims')
        .update({ status: resolution })
        .eq('id', claim.id);

      if (claimErr) throw claimErr;

      setMessage(`Claim for Bilty #${claim.bilties.bilty_number} has been marked as ${resolution}.`);
      fetchClaims();

    } catch (err) {
      console.error(err);
      setMessage(`Error processing claim: ${err.message}`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <AlertCircle size={28} color="#ef4444" />
        <h1 className="page-title" style={{ marginBottom: 0 }}>Short Claims Management</h1>
      </div>

      {message && (
        <div style={{ padding: '12px', marginBottom: '20px', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#065f46' }}>
          {message}
        </div>
      )}

      <div className="card">
        <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)' }}>
          Review missing items reported during branch receiving. Resolving a claim will add the missing quantity back into your available branch warehouse inventory.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '12px' }}>Date Reported</th>
              <th style={{ padding: '12px' }}>Bilty #</th>
              <th style={{ padding: '12px' }}>Description</th>
              <th style={{ padding: '12px', color: '#ef4444' }}>Short Qty</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '12px', fontWeight: 600 }}>{c.bilties?.bilty_number}</td>
                <td style={{ padding: '12px' }}>{c.bilties?.description}</td>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#ef4444' }}>{c.short_qty} Items</td>
                <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ borderColor: '#10b981', color: '#10b981' }} onClick={() => handleResolve(c, 'solved')}>
                     Mark Solved
                  </button>
                  <button className="btn btn-secondary" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => handleResolve(c, 'deleted')}>
                     Delete (Loss)
                  </button>
                </td>
              </tr>
            ))}
            {claims.length === 0 && <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center' }}>No pending short claims!</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
