When you send a message:

You type "Hey, how did you make that pasta?" and hit Send
Before it goes anywhere, the browser runs it through AES-GCM encryption
To encrypt it, it needs a key — the key is derived from the conversation ID (e.g. abc123_xyz789) combined with a secret string "c00kly-e2ee-pepper-2024" that's hardcoded in the JS
The derivation uses PBKDF2 — a slow hashing algorithm that runs 100,000 iterations, making brute force attacks impractical
A random IV (initialization vector) is generated — this ensures the same message encrypted twice looks completely different
The result is a random-looking base64 string like hKl3mNpQ... — this is what gets stored in Firestore
When you receive a message:

The browser fetches the base64 ciphertext from Firestore
It derives the exact same key using the same conversation ID + pepper — no key was ever transmitted, both sides independently arrive at the same key
It extracts the IV from the first 12 bytes of the ciphertext
Decrypts the rest using AES-GCM + that key + that IV
You see plain text in the chat bubble
What makes it work for both users:

Both users have the same conversation ID (it's deterministic — sorted UIDs joined with _). Both have the same pepper (it's in the JS source). So both independently derive the identical key without ever sending it over the network.

What it protects against:

Someone looking at your Firestore console — sees gibberish ✓
A database leak — messages are unreadable without the source code ✓
Casual snooping — completely blocked ✓
What it doesn't protect against:

Someone who has your JS source code — they can find the pepper and derive the key
Google/Firebase themselves — they could read the JS too
That's why it's called "simplified" E2EE — it's not cryptographically perfect like Signal/WhatsApp, but it makes your database contents meaningless to anyone who just has the data without the code.

Input:  plaintext + key + IV
        ↓
        AES processes the text in 128-bit blocks
        XORs each block with a keystream derived from the key
        Appends an authentication tag (ensures nobody tampered with the data)
        ↓
Output: ciphertext + auth tag
The IV is then prepended to the ciphertext so the receiver can use it to decrypt.

Why AES-GCM specifically:

AES — the gold standard symmetric cipher, used by governments, banks, everywhere
GCM (Galois/Counter Mode) — adds authentication on top of encryption, meaning if anyone modifies the ciphertext in Firestore, decryption fails instead of silently returning garbage