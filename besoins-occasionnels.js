// =========================================
// 📋 MODULE BESOINS OCCASIONNELS
// =========================================
// Gestion des missions intérim hebdomadaires
// Génération automatique des tableaux pour ManPower, ASEA et client
// Version 1.0 - Février 2026
// =========================================

const BesoinOccasionnel = {
    // État temporaire pour la sélection d'agence
    tempInterimData: null,

    // =====================================
    // MISSIONS CLIENT
    // =====================================

    showClientMissionModal() {
        // Peupler la liste des salariées
        const select = document.getElementById('clientEmployeeChoice');
        select.innerHTML = '<option value="">-- Choisir --</option>';
        EMPLOYEES.forEach(emp => {
            select.innerHTML += `<option value="${emp.name}">${emp.name}</option>`;
        });
        
        // Afficher la modal
        planning.showModal('clientMissionModal');
    },

    toggleClientMissionFields() {
        const type = document.querySelector('input[name="clientMissionType"]:checked').value;
        const employeeSelect = document.getElementById('clientEmployeeSelect');
        const interimFields = document.getElementById('clientInterimFields');
        
        if (type === 'employee') {
            employeeSelect.style.display = 'block';
            interimFields.style.display = 'none';
        } else {
            employeeSelect.style.display = 'none';
            interimFields.style.display = 'block';
        }
    },

    saveClientMission() {
        const officeName = document.getElementById('clientOfficeName').value.trim();
        const type = document.querySelector('input[name="clientMissionType"]:checked').value;
        const hours = document.getElementById('clientMissionHours').value.trim();
        const reason = document.getElementById('clientMissionReason').value.trim();
        
        if (!officeName || !hours || !reason) {
            alert('❌ Veuillez remplir tous les champs');
            return;
        }
        
        let personName = '';
        let agency = null;
        
        if (type === 'employee') {
            personName = document.getElementById('clientEmployeeChoice').value;
            if (!personName) {
                alert('❌ Veuillez sélectionner une salariée');
                return;
            }
        } else {
            personName = document.getElementById('clientInterimName').value.trim();
            agency = document.querySelector('input[name="clientInterimAgency"]:checked').value;
            if (!personName) {
                alert('❌ Veuillez entrer le nom de l\'intérimaire');
                return;
            }
        }
        
        // Créer la mission
        const dateKey = planning.getDateKey(planning.currentDate);
        if (!planning.plannings[dateKey]) {
            planning.plannings[dateKey] = {};
        }
        if (!planning.plannings[dateKey].clientMissions) {
            planning.plannings[dateKey].clientMissions = [];
        }
        
        const mission = {
            id: Date.now(),
            officeName: officeName,
            personType: type,
            personName: personName,
            agency: agency,
            hours: hours,
            reason: reason
        };
        
        planning.plannings[dateKey].clientMissions.push(mission);
        planning.saveToStorage();
        
        // Fermer la modal et rafraîchir
        planning.closeModal('clientMissionModal');
        this.renderClientMissions();
        
        // Réinitialiser le formulaire
        document.getElementById('clientOfficeName').value = '';
        document.getElementById('clientMissionHours').value = '';
        document.getElementById('clientMissionReason').value = '';
        document.getElementById('clientInterimName').value = '';
        
        alert('✅ Mission client enregistrée !');
    },

    renderClientMissions() {
        const dateKey = planning.getDateKey(planning.currentDate);
        const missions = planning.plannings[dateKey]?.clientMissions || [];
        
        const container = document.getElementById('clientMissionsList');
        if (!container) return;
        
        if (missions.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">Aucune mission client pour ce jour</p>';
            return;
        }
        
        container.innerHTML = missions.map(mission => `
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid var(--equy-blue); position: relative;">
                <button 
                    onclick="BesoinOccasionnel.removeClientMission(${mission.id})"
                    style="position: absolute; top: 8px; right: 8px; background: var(--equy-red); color: white; border: none; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; font-size: 12px;">
                    ✕
                </button>
                <strong>Office:</strong> ${mission.officeName}<br>
                <strong>Envoyé:</strong> ${mission.personName}${mission.agency ? ' (' + mission.agency.toUpperCase() + ')' : ''}<br>
                <strong>Horaires:</strong> ${mission.hours} (${this.calculateHours(mission.hours)}h)<br>
                <strong>Raison:</strong> ${mission.reason}
            </div>
        `).join('');
    },

    removeClientMission(missionId) {
        if (!confirm('Supprimer cette mission client ?')) return;
        
        const dateKey = planning.getDateKey(planning.currentDate);
        const missions = planning.plannings[dateKey]?.clientMissions || [];
        
        planning.plannings[dateKey].clientMissions = missions.filter(m => m.id !== missionId);
        planning.saveToStorage();
        this.renderClientMissions();
    },

    // =====================================
    // GESTION AGENCE INTÉRIMAIRES
    // =====================================

    showAgencySelectModal(office, position) {
        this.tempInterimData = { office, position };
        planning.showModal('agencySelectModal');
    },

    confirmAgencySelection() {
        if (!this.tempInterimData) return;
        
        const agency = document.querySelector('input[name="interimAgency"]:checked').value;
        const { office, position } = this.tempInterimData;
        
        console.log('🔵 Agence sélectionnée:', agency);
        
        // DÉSACTIVER temporairement la synchro Firebase
        const wasSyncing = planning.isSyncing;
        planning.isSyncing = true;  // Bloque les updates Firebase
        
        // Vérifier si c'est un remplacement (personne absente)
        const dateKey = planning.getDateKey(planning.currentDate);
        const currentAssignment = planning.plannings[dateKey]?.[`${office}_${position}`];
        
        const interimData = { 
            type: 'interim', 
            name: '', 
            hours: currentAssignment?.hours || '',
            agency: agency  // IMPORTANT: L'agence DOIT être ici
        };
        
        if (currentAssignment && currentAssignment.type === 'absent') {
            // C'est un remplacement - NE PAS ÉCRASER, AJOUTER LE REPLACEMENT
            console.log('✅ C\'est un remplacement');
            planning.addReplacement(office, position, interimData);
            
            // Vérifier et forcer l'agence dans le replacement
            const assignment = planning.plannings[dateKey][`${office}_${position}`];
            if (assignment && assignment.replacement) {
                assignment.replacement.agency = agency;
                console.log('✅ Remplacement enregistré avec agence:', agency);
            }
        } else {
            // C'est un intérimaire seul - OK d'écraser
            console.log('✅ C\'est un intérimaire seul');
            planning.addAssignment(office, position, interimData);
            
            // Forcer l'assignation complète
            if (!planning.plannings[dateKey]) planning.plannings[dateKey] = {};
            planning.plannings[dateKey][`${office}_${position}`] = interimData;
            console.log('✅ Intérimaire enregistré avec agence:', agency);
        }
        
        // Sauvegarder dans localStorage
        localStorage.setItem('plannings', JSON.stringify(planning.plannings));
        
        // Sauvegarder dans Firebase avec merge explicite
        if (typeof db !== 'undefined' && db) {
            const saveData = {};
            saveData[`${office}_${position}`] = planning.plannings[dateKey][`${office}_${position}`];
            
            db.collection('plannings').doc(dateKey).set(saveData, { merge: true }).then(() => {
                console.log('✅ Agence sauvegardée dans Firebase');
                
                // Réactiver la synchro après 1 seconde
                setTimeout(() => {
                    planning.isSyncing = wasSyncing;
                    console.log('🔄 Synchronisation Firebase réactivée');
                }, 1000);
            }).catch(error => {
                console.error('❌ Erreur sauvegarde Firebase:', error);
                planning.isSyncing = wasSyncing;
            });
        } else {
            // Pas de Firebase, réactiver immédiatement
            planning.isSyncing = wasSyncing;
        }
        
        // Vérifier ce qui a été enregistré
        setTimeout(() => {
            const saved = planning.plannings[dateKey]?.[`${office}_${position}`];
            console.log('💾 Vérification finale:', saved);
            if (saved && saved.type === 'absent') {
                if (saved.replacement && saved.replacement.agency) {
                    console.log('✅ SUCCÈS: Absent avec replacement agency:', saved.replacement.agency);
                } else {
                    console.error('❌ BUG: Replacement sans agence !', saved);
                }
            } else if (saved && saved.type === 'interim') {
                if (saved.agency) {
                    console.log('✅ SUCCÈS: Intérimaire seul avec agency:', saved.agency);
                } else {
                    console.error('❌ BUG: Intérimaire sans agence !', saved);
                }
            } else {
                console.error('❌ BUG: Données incorrectes !', saved);
            }
        }, 1500);
        
        planning.closeModal('agencySelectModal');
        this.tempInterimData = null;
    },

    // =====================================
    // CALCUL DES HEURES
    // =====================================

    calculateHours(hoursString) {
        if (!hoursString || !hoursString.includes('-')) return 0;
        
        try {
            const [start, end] = hoursString.split('-');
            
            const parseTime = (timeStr) => {
                // Gérer les formats: 9h, 9h30, 09h30, 9:30, etc.
                const cleaned = timeStr.replace(/[h:]/g, ':');
                const parts = cleaned.split(':');
                const hours = parseInt(parts[0]) || 0;
                const minutes = parseInt(parts[1]) || 0;
                return hours + minutes / 60;
            };
            
            const startTime = parseTime(start);
            const endTime = parseTime(end);
            
            // Calculer les heures et déduire 0.5h de pause
            const totalHours = endTime - startTime - 0.5;
            
            // Éviter les valeurs négatives
            return Math.max(0, Math.round(totalHours * 10) / 10);
        } catch (e) {
            return 0;
        }
    },

    extractLastName(fullName) {
        if (!fullName) return '';
        const parts = fullName.trim().split(' ');
        // En format français : "GUIGNE Juline" → On prend le premier mot (nom de famille)
        return parts[0];
    },

    // =====================================
    // COLLECTE DES MISSIONS
    // =====================================

    collectWeekMissions(startDate, endDate) {
        const missions = {
            client: [],
            nous: [],
            manpower: [],
            asea: []
        };
        
        // Calculer le nombre de jours entre start et end
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        
        console.log(`📅 Collecte du ${start.toLocaleDateString()} au ${end.toLocaleDateString()} (${daysDiff + 1} jours)`);
        
        // Parcourir tous les jours (inclus le dernier)
        for (let i = 0; i <= daysDiff; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            
            const dateKey = planning.getDateKey(currentDate);
            const dayPlanning = planning.plannings[dateKey] || {};
            const dayName = currentDate.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'numeric' });
            
            console.log(`  ${dateKey}: ${Object.keys(dayPlanning).length} clés`);
            
            // === MISSIONS CLIENT ===
            if (dayPlanning.clientMissions && dayPlanning.clientMissions.length > 0) {
                dayPlanning.clientMissions.forEach(mission => {
                    const missionData = {
                        date: dayName,
                        office: mission.officeName,
                        hours: mission.hours,
                        reason: mission.reason,
                        name: this.extractLastName(mission.personName),
                        hoursCalculated: this.calculateHours(mission.hours)
                    };
                    
                    missions.client.push(missionData);
                    
                    // Si intérimaire avec agence
                    if (mission.personType === 'interim' && mission.agency) {
                        if (mission.agency === 'manpower') {
                            missions.manpower.push(missionData);
                        } else if (mission.agency === 'asea') {
                            missions.asea.push(missionData);
                        }
                    }
                });
            }
            
            // === MISSIONS POUR NOUS (intérimaires sur nos offices) ===
            Object.entries(dayPlanning).forEach(([key, assignment]) => {
                if (key.endsWith('_notes') || key === 'clientMissions') return;
                
                const officeName = key.split('_')[0];
                
                // Intérimaire direct
                if (assignment && assignment.type === 'interim') {
                    const missionData = {
                        date: dayName,
                        office: officeName,
                        hours: assignment.hours || 'À définir',
                        reason: 'Renfort',
                        name: this.extractLastName(assignment.name || 'À définir'),
                        hoursCalculated: this.calculateHours(assignment.hours || '')
                    };
                    
                    missions.nous.push(missionData);
                    
                    // Debug: afficher l'agence
                    console.log('📋 Intérimaire trouvé:', {
                        office: officeName,
                        name: assignment.name,
                        agency: assignment.agency
                    });
                    
                    if (assignment.agency === 'manpower') {
                        missions.manpower.push(missionData);
                        console.log('✅ Ajouté à ManPower');
                    } else if (assignment.agency === 'asea') {
                        missions.asea.push(missionData);
                        console.log('✅ Ajouté à ASEA');
                    } else {
                        console.log('⚠️ Pas d\'agence définie pour cet intérimaire');
                    }
                }
                
                // Absent avec remplaçant
                if (assignment && assignment.type === 'absent' && assignment.replacement) {
                    const repl = assignment.replacement;
                    const missionData = {
                        date: dayName,
                        office: officeName,
                        hours: repl.hours || 'À définir',
                        reason: `Rempl. ${this.extractLastName(assignment.name)}`,
                        name: this.extractLastName(repl.name || 'À définir'),
                        hoursCalculated: this.calculateHours(repl.hours || '')
                    };
                    
                    missions.nous.push(missionData);
                    
                    console.log('📋 Absent avec replacement trouvé:', {
                        office: officeName,
                        absent: assignment.name,
                        replacement: repl.name,
                        agency: repl.agency
                    });
                    
                    if (repl.type === 'interim' && repl.agency) {
                        if (repl.agency === 'manpower') {
                            missions.manpower.push(missionData);
                            console.log('✅ Ajouté à ManPower (replacement)');
                        } else if (repl.agency === 'asea') {
                            missions.asea.push(missionData);
                            console.log('✅ Ajouté à ASEA (replacement)');
                        }
                    }
                }
            });
        }
        
        // Calculer les totaux
        ['client', 'nous', 'manpower', 'asea'].forEach(key => {
            missions[key].totalHours = missions[key].reduce((sum, m) => sum + m.hoursCalculated, 0);
            missions[key].count = missions[key].length;
        });
        
        missions.total = {
            hours: missions.client.totalHours + missions.nous.totalHours,
            count: missions.client.count + missions.nous.count
        };
        
        return missions;
    },

    // =====================================
    // AFFICHAGE BESOINS OCCASIONNELS
    // =====================================

    renderOccasionalNeeds() {
        const startOfWeek = planning.getStartOfWeek(planning.currentDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 4); // Vendredi (4 jours après lundi)
        
        const weekNumber = this.getWeekNumber(startOfWeek);
        const missions = this.collectWeekMissions(startOfWeek, endOfWeek);
        
        return `
            <div class="occasional-needs" style="padding: 20px;">
                <h2 style="color: var(--equy-blue); margin-bottom: 8px;">📋 Besoins Occasionnels - Semaine ${weekNumber}</h2>
                <p style="color: #666; margin-bottom: 24px;">Du ${startOfWeek.toLocaleDateString('fr-FR')} au ${endOfWeek.toLocaleDateString('fr-FR')}</p>
                
                ${this.renderMissionTable('MISSIONS POUR LE CLIENT', missions.client, '#5fc2dd')}
                ${this.renderMissionTable('MISSIONS POUR NOUS', missions.nous, '#82bb2b')}
                ${this.renderMissionTable('MISSIONS MANPOWER', missions.manpower, '#2a3558')}
                ${this.renderMissionTable('MISSIONS ASEA', missions.asea, '#e62c1b')}
                
                <div class="recap-section" style="background: white; padding: 20px; border-radius: 12px; border: 2px solid var(--equy-blue); margin-top: 24px;">
                    <h3 style="color: var(--equy-blue); margin-bottom: 12px;">📊 RÉCAP SEMAINE ${weekNumber}</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                        <div>Client : <strong>${missions.client.totalHours}h</strong> (${missions.client.count} missions)</div>
                        <div>Pour Nous : <strong>${missions.nous.totalHours}h</strong> (${missions.nous.count} missions)</div>
                        <div>ManPower : <strong>${missions.manpower.totalHours}h</strong> (${missions.manpower.count} missions)</div>
                        <div>ASEA : <strong>${missions.asea.totalHours}h</strong> (${missions.asea.count} missions)</div>
                    </div>
                    <div style="padding-top: 12px; border-top: 2px solid #e0e0e0; font-size: 16px; font-weight: 700; color: var(--equy-blue);">
                        TOTAL : ${missions.total.hours}h (${missions.total.count} missions)
                    </div>
                </div>
                
                <div class="export-controls" style="background: white; padding: 20px; border-radius: 12px; border: 2px solid var(--equy-blue); margin-top: 24px;">
                    <h3 style="color: var(--equy-blue); margin-bottom: 16px;">📥 Exporter les tableaux</h3>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--equy-blue);">Quel tableau exporter ?</label>
                        <select id="exportTableSelect" class="form-input" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; font-family: inherit;">
                            <option value="all">📊 Tout (tous les tableaux)</option>
                            <option value="client">🏢 Client</option>
                            <option value="nous">👥 Pour Nous</option>
                            <option value="manpower">🔵 ManPower</option>
                            <option value="asea">🔴 ASEA</option>
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                        <button onclick="BesoinOccasionnel.exportPDFFromSelect()" class="btn btn-primary" style="flex: 1; padding: 14px; font-size: 15px;">
                            📄 Export PDF
                        </button>
                        <button onclick="BesoinOccasionnel.exportCSVFromSelect()" class="btn btn-secondary" style="flex: 1; padding: 14px; font-size: 15px;">
                            📥 Export CSV
                        </button>
                    </div>
                    
                    <div style="padding-top: 16px; border-top: 2px solid #e0e0e0;">
                        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                            <h4 style="color: #2a3558; margin: 0 0 12px 0; font-size: 15px;">📧 Envoi récap ManPower</h4>
                            <p style="font-size: 13px; color: #666; margin-bottom: 16px;">En 2 étapes simples :</p>
                            
                            <button onclick="BesoinOccasionnel.exportManpowerPDF()" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 14px; margin-bottom: 12px; background: #2a3558;">
                                📄 1. Exporter PDF ManPower
                            </button>
                            
                            <button onclick="BesoinOccasionnel.sendManpowerWeeklyEmail()" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 14px; background: linear-gradient(135deg, #2a3558 0%, #5fc2dd 100%);">
                                📧 2. Ouvrir email (joindre PDF)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderMissionTable(title, missions, color) {
        // Déterminer le type de tableau
        let tableType = '';
        if (title.includes('CLIENT')) tableType = 'client';
        else if (title.includes('POUR NOUS')) tableType = 'nous';
        else if (title.includes('MANPOWER')) tableType = 'manpower';
        else if (title.includes('ASEA')) tableType = 'asea';
        
        if (missions.length === 0) {
            return `
                <div class="mission-table" data-table-type="${tableType}" style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid ${color}; margin-bottom: 16px;">
                    <h3 style="color: ${color}; margin-bottom: 12px;">${title}</h3>
                    <p style="color: #999; text-align: center;">Aucune mission</p>
                </div>
            `;
        }
        
        return `
            <div class="mission-table" data-table-type="${tableType}" style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid ${color}; margin-bottom: 16px;">
                <h3 style="color: ${color}; margin-bottom: 12px;">${title}</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: 600;">Date</th>
                                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: 600;">Office</th>
                                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: 600;">Horaires</th>
                                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: 600;">Raison</th>
                                <th style="padding: 8px; text-align: left; font-size: 12px; font-weight: 600;">Nom</th>
                                <th style="padding: 8px; text-align: right; font-size: 12px; font-weight: 600;">Heures</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${missions.map(m => `
                                <tr style="border-bottom: 1px solid #e0e0e0;">
                                    <td style="padding: 8px; font-size: 13px;">${m.date}</td>
                                    <td style="padding: 8px; font-size: 13px;">${m.office}</td>
                                    <td style="padding: 8px; font-size: 13px;">${m.hours}</td>
                                    <td style="padding: 8px; font-size: 13px;">${m.reason}</td>
                                    <td style="padding: 8px; font-size: 13px; font-weight: 600;">${m.name}</td>
                                    <td style="padding: 8px; text-align: right; font-size: 13px; font-weight: 600;">${m.hoursCalculated}h</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f8f9fa; font-weight: 700;">
                                <td colspan="5" style="padding: 8px; text-align: right;">TOTAL SEMAINE</td>
                                <td style="padding: 8px; text-align: right; color: ${color};">${missions.totalHours}h</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    },

    // =====================================
    // UTILITAIRES
    // =====================================

    getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    },

    // =====================================
    // EXPORTS
    // =====================================

    exportPDF(type = 'all') {
        // Générer le nom du fichier
        const startOfWeek = planning.getStartOfWeek(planning.currentDate);
        const weekNumber = this.getWeekNumber(startOfWeek);
        const typeLabel = type === 'all' ? 'Complet' : 
                         type === 'client' ? 'Client' :
                         type === 'nous' ? 'PourNous' :
                         type === 'manpower' ? 'ManPower' : 'ASEA';
        const filename = `Besoins-Semaine${weekNumber}-${typeLabel}.pdf`;
        
        // Créer un conteneur temporaire pour le PDF
        const originalContent = document.querySelector('.occasional-needs');
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.width = '210mm'; // A4
        tempContainer.style.padding = '20px';
        tempContainer.style.backgroundColor = 'white';
        tempContainer.style.fontFamily = 'Arial, sans-serif';
        
        // Cloner le contenu
        tempContainer.innerHTML = originalContent.innerHTML;
        
        // Si export sélectif, cacher les autres tableaux
        if (type !== 'all') {
            const tables = tempContainer.querySelectorAll('.mission-table');
            tables.forEach(table => {
                const title = table.querySelector('h3')?.textContent || '';
                const shouldShow = (
                    (type === 'client' && title.includes('CLIENT')) ||
                    (type === 'nous' && title.includes('NOUS') && !title.includes('CLIENT')) ||
                    (type === 'manpower' && title.includes('MANPOWER')) ||
                    (type === 'asea' && title.includes('ASEA'))
                );
                if (!shouldShow) {
                    table.style.display = 'none';
                }
            });
        }
        
        // Ajouter au DOM
        document.body.appendChild(tempContainer);
        
        // Charger html2pdf depuis CDN et générer le PDF
        if (typeof html2pdf === 'undefined') {
            // Charger la bibliothèque
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = () => {
                this.generatePDF(tempContainer, filename);
            };
            document.head.appendChild(script);
        } else {
            this.generatePDF(tempContainer, filename);
        }
    },
    
    generatePDF(element, filename) {
        const opt = {
            margin: 10,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            // Nettoyer le conteneur temporaire
            element.remove();
            alert('✅ PDF téléchargé avec succès !');
        }).catch(err => {
            console.error('Erreur génération PDF:', err);
            element.remove();
            alert('❌ Erreur lors de la génération du PDF. Utilisez Ctrl+P pour imprimer.');
        });
    },

    exportCSV(type = 'all') {
        const startOfWeek = planning.getStartOfWeek(planning.currentDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const weekNumber = this.getWeekNumber(startOfWeek);
        const missions = this.collectWeekMissions(startOfWeek, endOfWeek);
        
        let csv = "Type,Date,Office,Horaires,Raison,Nom,Heures\n";
        let filename = `besoins_occasionnels_semaine_${weekNumber}`;
        
        // Export sélectif
        if (type === 'client' || type === 'all') {
            missions.client.forEach(m => {
                csv += `Client,${m.date},${m.office},${m.hours},${m.reason},${m.name},${m.hoursCalculated}\n`;
            });
        }
        
        if (type === 'nous' || type === 'all') {
            missions.nous.forEach(m => {
                csv += `Pour Nous,${m.date},${m.office},${m.hours},${m.reason},${m.name},${m.hoursCalculated}\n`;
            });
        }
        
        if (type === 'manpower' || type === 'all') {
            missions.manpower.forEach(m => {
                csv += `ManPower,${m.date},${m.office},${m.hours},${m.reason},${m.name},${m.hoursCalculated}\n`;
            });
        }
        
        if (type === 'asea' || type === 'all') {
            missions.asea.forEach(m => {
                csv += `ASEA,${m.date},${m.office},${m.hours},${m.reason},${m.name},${m.hoursCalculated}\n`;
            });
        }
        
        // Ajuster le nom du fichier selon le type
        if (type !== 'all') {
            filename += `_${type}`;
        }
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    },
    
    // =====================================
    // EXPORTS DEPUIS SELECT
    // =====================================
    
    exportPDFFromSelect() {
        const select = document.getElementById('exportTableSelect');
        const type = select ? select.value : 'all';
        this.exportPDF(type);
    },
    
    exportCSVFromSelect() {
        const select = document.getElementById('exportTableSelect');
        const type = select ? select.value : 'all';
        this.exportCSV(type);
    },
    
    // =====================================
    // EMAIL MANPOWER
    // =====================================
    
    sendManpowerWeeklyEmail() {
        const startOfWeek = planning.getStartOfWeek(planning.currentDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 4); // Vendredi (4 jours après lundi)
        
        const weekNumber = this.getWeekNumber(startOfWeek);
        const missions = this.collectWeekMissions(startOfWeek, endOfWeek);
        
        // Vérifier qu'il y a des missions ManPower
        if (missions.manpower.length === 0) {
            alert('❌ Aucune mission ManPower pour cette semaine');
            return;
        }
        
        // Générer le contenu de l'email simplifié
        const subject = `Récapitulatif des demandes - Semaine ${weekNumber}`;
        
        let body = `Bonjour,%0D%0A%0D%0A`;
        body += `Vous trouverez ci-joint le récapitulatif des missions commandées cette semaine.%0D%0A%0D%0A`;
        body += `En vous souhaitant un bon week-end,%0D%0A`;
        body += `Bien cordialement,`;
        
        // Créer le lien mailto
        const to = 'evry-restauration.industrie@manpower.fr';
        const cc = 'juline.guigne@equytables.com,stephanie.hiroux@equytables.com,sandra.bellanger-retif@equytables.com';
        const mailtoLink = `mailto:${to}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${body}`;
        
        // Ouvrir le client email
        window.location.href = mailtoLink;
    },
    
    exportManpowerPDF() {
        // Export direct du PDF ManPower
        this.exportPDF('manpower');
    }
};

// Exposer globalement
window.BesoinOccasionnel = BesoinOccasionnel;
