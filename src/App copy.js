import './App.css';
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import { SimplePool, nip19 } from 'nostr-tools';

function App() {
  const pool = new SimplePool();
  const [pubkey, setPubkey] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [relays, setRelays] = useState([
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://nostr.bitcoiner.social/',
    'wss://nostr21.com/',
    'wss://nostr-pub.wellorder.net',
    'wss://offchain.pub',
    'wss://relay.current.fyi',
    'wss://nostr.shroomslab.net',
    'wss://relayable.org',
    'wss://nostr.thank.eu'
  ].map(r => [r, { read: true, write: true }]));

  async function loadDistrust() {
    const users = Object.keys(window.myFollows);
    const filters = [
      {
        kinds: [10000],
        authors: users
      }
    ];
    const distrust = await pool.list(getReadRelays(), filters);
    window.distrust = {};
    distrust.forEach(event => {
      const author = event.pubkey;
      const target = event.tags[0][1];
      if (!(target in window.distrust)) {
        window.distrust[target] = [];
      }
      window.distrust[target].push(author);
    });
  }

  async function findRelays() {
    try {
      const events = await pool.list(getAllRelays(), [
        {
          kinds: [3, 10002],
          authors: [await window.nostr.getPublicKey()]
        }
      ]);

      events.sort((a, b) => b.created_at - a.created_at);
      const event = events[0];

      const relays = event.kind === 3
        ? Object.entries(JSON.parse(events[2].content))
        : event.tags
          .filter(t => t[0] === 'r')
          .map(t => [
            t[1],
            !t[2]
              ? { read: true, write: true }
              : { read: t[2] === 'read', write: t[2] === 'write' }
          ]);

      setRelays(relays);
    } catch (error) {
      console.error('Error in findRelays:', error);
    }
  }

  useEffect(() => {
    const storedPubkey = localStorage.getItem('pubkey');
    if (storedPubkey) {
      setPubkey(storedPubkey);
    } else {
      setTimeout(async () => {
        try {
          const pubkey = await window.nostr.getPublicKey();
          localStorage.setItem('pubkey', pubkey);
          setPubkey(pubkey);
        } catch (error) {
          console.error('Error getting public key:', error);
        }
      }, 200);
    }
  }, []);

  useEffect(() => {
    if (pubkey) {
      (async () => {
        await profile();
        loadData();
      })();
    }
  }, [pubkey]);

  function getReadRelays() {
    return relays.filter(r => r[1].read).map(r => r[0]);
  }
  
  findRelays();
  follows();

  async function profile() {
    try {
      setContacts([]);
      const filter = {
        kinds: [3],
        authors: [pubkey]
      };

      const events = await pool.list(getReadRelays(), [filter]);
      events.sort((a, b) => b.created_at - a.created_at);

      const follows = events[0].tags.filter(t => t[0] === 'p').map(t => t[1]);
      follows.push(pubkey);

      const followsSet = new Set(follows);

      filter.kinds = [0];
      filter.authors = followsSet;

      window.myFollows = {};
      for (const f of followsSet) {
        window.myFollows[f] = {
          followedBy: [],
          mutedBy: [],
          reportedBy: []
        };
      }

      const contacts = [];
      const profiles = {};

      events.forEach(e => {
        try {
          const c = JSON.parse(e.content);
          c.npub = nip19.npubEncode(e.pubkey);
          c.name = c.displayName || c.name;
          c.distrust = new Set();
          c.followers = 0;
          contacts.push(c);
          profiles[e.pubkey] = c;
        } catch (error) {
          console.error('Error parsing contact:', error);
        }
      });

      setContacts(contacts);

      window.profiles = profiles;
    } catch (error) {
      console.error('Error in profile:', error);
    }
  }

            async function follows(users) {
              try {
                const filter = {
                  kinds: [3],
                  authors: users
                };

                const prefollows = await pool.list(getReadRelays(), [filter]);
                const follows = [];

                prefollows.forEach(event => {
                  const array = [];
                  array.push(event.tags);
                  const l = [event.pubkey];
                  array[0].forEach(item => l.push(item[1]));
                  follows.push(l);
                  l.forEach(p => {
                    if (p in window.myFollows) {
                      window.myFollows[p].followedBy.push(l[0]);
                    }
                  });
                });

                window.list_of_people_followed_by_my_followers = follows;
              } catch (error) {
                console.error('Error in follows:', error);
              }
            }

            async function loadDistrust() {
              const users = Object.keys(window.myFollows);
              const filters = [
                {
                  kinds: [10000],
                  authors: users,
                  '#p': users
                },
                {
                  kinds: [30000],
                  authors: users,
                  '#d': ['mute'],
                  '#p': users
                },
                {
                  kinds: [1984],
                  authors: users,
                  '#p': users
                },
                {
                  kinds: [3],
                  authors: users,
                  '#p': users
                }
              ];

              for (const filter of filters) {
                const events = await pool.list(getReadRelays(), [filter]);
                events.forEach(e => {
                  if (e.kind === 1984) {
                    if (e.tags.find(t => t[0] === 'p')[1] in window.myFollows) {
                      window.myFollows[e.tags.find(t => t[0] === 'p')[1]].reportedBy.push(e.pubkey);
                    }
                  } else if (e.kind === 3) {
                    e.tags.filter(t => t[0] === 'p').forEach(t => {
                      window.myFollows[t[1]]?.followedBy.push(e.pubkey);
                    });
                  } else {
                    e.tags.filter(t => t[0] === 'p').forEach(t => {
                      window.myFollows[t[1]]?.mutedBy.push(e.pubkey);
                    });
                  }
                });
              }
            }

            async function loadData() {
              try {
                await loadDistrust();

                const myFollows = window.myFollows;
                const profiles = window.profiles;

                Object.keys(myFollows).forEach(k => {
                  const f = myFollows[k];
                  f.mutedBy.forEach(u => {
                    if (profiles[u]) profiles[k]?.distrust.add('muted by ' + profiles[u].name);
                  });
                  f.reportedBy.forEach(u => {
                    if (profiles[u]) profiles[k]?.distrust.add('reported by ' + profiles[u].name);
                  });
                  f.followedBy.forEach(u => {
                    if (profiles[u] && profiles[k]) profiles[k].followers++;
                  });
                });

                setContacts(c => {
                  c = [...c].filter(c => c.distrust.size);
                  c.forEach(c => c.score = Math.floor(100 * c.followers / (c.distrust.size + c.followers)));
                  c.sort((a, b) => a.score - b.score);
                  return c;
                });
              } catch (error) {
                console.error('Error in loadData:', error);
              }
            }

            function Page() {
              const { npub } = useParams();
              setPubkey(npub ? nip19.decode(npub).data : localStorage.getItem('pubkey'));

              return (
                <div className="App">
                  <header className="App-header">
          <div className="container">
            <Link to="/">Home</Link>
            <p />
            {contacts.map(c => (
              <div key={c.npub}>
                <Link to={'/' + c.npub}>
                  <img src={c.picture} alt="" width={100} />
                </Link>{' '}
                {c.name}
                <br /> {c.score}% trusted {c.followers} followers
                {[...c.distrust].map(d => (
                  <div key={d}>
                    <small><small>{d}</small></small>
                  </div>
                ))}
                <p />
              </div>
            ))}
          </div>
        </header>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/:npub?" element={<Page />} />
      </Routes>
    </Router>
  );
}

export default App;
