

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Schedule, Service, Officer, Assignment, Personnel, Rank, ServiceTemplate, rankOrder, Roster } from './types';
import { scheduleData as preloadedScheduleData } from './data/scheduleData';
import { rosterData as preloadedRosterData } from './data/rosterData';
import { commandPersonnelData as defaultCommandPersonnel } from './data/commandPersonnelData';
import { servicePersonnelData as defaultServicePersonnel } from './data/servicePersonnelData';
import { defaultUnits } from './data/unitData';
import { defaultServiceTemplates } from './data/serviceTemplates';
import { exportScheduleToWord, exportScheduleByTimeToWord, exportScheduleAsExcelTemplate, exportScheduleAsWordTemplate } from './services/exportService';
import { parseServicesFromWord } from './services/wordImportService';
import ScheduleDisplay from './components/ScheduleDisplay';
import TimeGroupedScheduleDisplay from './components/TimeGroupedScheduleDisplay';
import Nomenclador from './components/Nomenclador';
import { CalendarIcon, BookOpenIcon, DownloadIcon, ClockIcon, ClipboardListIcon, RefreshIcon, EyeIcon, EyeOffIcon, UploadIcon, QuestionMarkCircleIcon, BookmarkIcon } from './components/icons';
import * as XLSX from 'xlsx';
import HelpModal from './components/HelpModal';
import RosterImportModal from './components/RosterImportModal';
import ServiceTemplateModal from './components/ServiceTemplateModal';
import ExportTemplateModal from './components/ExportTemplateModal';

type View = 'schedule' | 'time-grouped' | 'nomenclador';

const initializeSchedule = (): Schedule => {
  let scheduleToLoad: any;

  try {
    const savedScheduleJSON = localStorage.getItem('scheduleData');
    if (savedScheduleJSON) {
      const parsedData = JSON.parse(savedScheduleJSON);
      // Basic validation
      if (parsedData && (Array.isArray(parsedData.services) || Array.isArray(parsedData.sportsEvents)) && Array.isArray(parsedData.commandStaff)) {
        scheduleToLoad = parsedData;
      } else {
        scheduleToLoad = preloadedScheduleData;
      }
    } else {
      scheduleToLoad = preloadedScheduleData;
    }
  } catch (e) {
    console.error("Failed to load or parse data from localStorage, falling back to default.", e);
    scheduleToLoad = preloadedScheduleData;
  }
  
  const dataCopy = JSON.parse(JSON.stringify(scheduleToLoad));

  // Migration logic for old data structure
  if (dataCopy.services && !('sportsEvents' in dataCopy)) {
    dataCopy.sportsEvents = dataCopy.services.filter((s: Service) => s.title.toUpperCase().includes('EVENTO DEPORTIVO'));
    dataCopy.services = dataCopy.services.filter((s: Service) => !s.title.toUpperCase().includes('EVENTO DEPORTIVO'));
  } else if (!dataCopy.services) {
    dataCopy.services = [];
  } 
  
  if (!dataCopy.sportsEvents) {
    dataCopy.sportsEvents = [];
  }


  let idCounter = 0;
  const processServices = (services: Service[]) => {
    (services || []).forEach((service: Service) => {
      if (!service.id) {
        service.id = `service-hydrated-${Date.now()}-${idCounter++}`;
      }
      service.isHidden = service.isHidden || false;
      (service.assignments || []).forEach((assignment: Assignment) => {
        if (!assignment.id) {
          assignment.id = `assign-hydrated-${Date.now()}-${idCounter++}`;
        }
      });
    });
    services.sort((a: Service, b: Service) => (a.isHidden ? 1 : 0) - (b.isHidden ? 1 : 0));
  };
  
  processServices(dataCopy.services);
  processServices(dataCopy.sportsEvents);


  (dataCopy.commandStaff || []).forEach((officer: Officer) => {
    if (!officer.id) {
      officer.id = `officer-hydrated-${Date.now()}-${idCounter++}`;
    }
  });

  return dataCopy;
};


const App: React.FC = () => {
  const [schedule, setSchedule] = useState<Schedule>(initializeSchedule);
  const [view, setView] = useState<View>('schedule');
  const [displayDate, setDisplayDate] = useState<Date | null>(null);
  const [commandPersonnel, setCommandPersonnel] = useState<Personnel[]>([]);
  const [servicePersonnel, setServicePersonnel] = useState<Personnel[]>([]);
  const [unitList, setUnitList] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const rosterInputRef = useRef<HTMLInputElement>(null);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplate[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalConfig, setTemplateModalConfig] = useState<{ mode: 'add' | 'replace', serviceType: 'common' | 'sports', serviceToReplaceId?: string }>({ mode: 'add', serviceType: 'common' });
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isExportTemplateModalOpen, setIsExportTemplateModalOpen] = useState(false);
  const isInitialLoad = useRef(true);


  const [roster, setRoster] = useState<Roster>(() => {
    try {
        const savedRoster = localStorage.getItem('rosterData');
        if (savedRoster) {
            return JSON.parse(savedRoster);
        }
    } catch (e) {
        console.error("Failed to load roster from localStorage", e);
    }
    return preloadedRosterData;
  });

  useEffect(() => {
    try {
      const savedTemplates = localStorage.getItem('serviceTemplates');
      if (savedTemplates) {
        setServiceTemplates(JSON.parse(savedTemplates));
      } else {
        setServiceTemplates(defaultServiceTemplates);
      }
    } catch (e) {
      console.error("Failed to load templates from localStorage", e);
      setServiceTemplates(defaultServiceTemplates);
    }
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);


  const updateAndSaveTemplates = (templates: ServiceTemplate[]) => {
    setServiceTemplates(templates);
    localStorage.setItem('serviceTemplates', JSON.stringify(templates));
  };

  const updateAndSaveRoster = (newRoster: Roster) => {
    setRoster(newRoster);
    localStorage.setItem('rosterData', JSON.stringify(newRoster));
  };
  

  useEffect(() => {
    try {
      const savedCommandPersonnelJSON = localStorage.getItem('commandPersonnel');
      if (savedCommandPersonnelJSON) {
        setCommandPersonnel(JSON.parse(savedCommandPersonnelJSON));
      } else {
        updateAndSaveCommandPersonnel(defaultCommandPersonnel);
      }

      const savedServicePersonnelJSON = localStorage.getItem('servicePersonnel');
       if (savedServicePersonnelJSON) {
        setServicePersonnel(JSON.parse(savedServicePersonnelJSON));
       } else {
        updateAndSaveServicePersonnel(defaultServicePersonnel);
       }

      const savedUnits = localStorage.getItem('unitList');
      if (savedUnits) {
        setUnitList(JSON.parse(savedUnits));
      } else {
        updateAndSaveUnits(defaultUnits);
      }
    } catch(e) {
        console.error("Failed to load nomenclador lists from localStorage.", e);
    }
  }, []);

  // Effect to initialize displayDate from the loaded schedule, runs only once
  useEffect(() => {
    const parsedDate = parseDateFromString(schedule.date);
    setDisplayDate(parsedDate);
  }, []);

  // Effect to save schedule to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('scheduleData', JSON.stringify(schedule));
    } catch (e) {
      console.error("Failed to save schedule data to localStorage", e);
    }
  }, [schedule]);
  
  // Effect to sync displayDate changes back to the main schedule object
  useEffect(() => {
    if (displayDate) {
      const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
      const newDateString = `${displayDate.getDate()} DE ${monthNames[displayDate.getMonth()]} DE ${displayDate.getFullYear()}`;
      if (schedule && schedule.date !== newDateString) {
        setSchedule(prev => ({ ...prev, date: newDateString }));
      }
    }
  }, [displayDate]);

  const sortPersonnel = (a: Personnel, b: Personnel) => {
    const rankComparison = (rankOrder[a.rank] || 99) - (rankOrder[b.rank] || 99);
    if (rankComparison !== 0) {
      return rankComparison;
    }
    return a.name.localeCompare(b.name);
  };

  const updateAndSaveCommandPersonnel = (newList: Personnel[]) => {
    const sortedList = newList.sort(sortPersonnel);
    setCommandPersonnel(sortedList);
    localStorage.setItem('commandPersonnel', JSON.stringify(sortedList));
  };

  const handleUpdateCommandPersonnel = (updatedPersonnel: Personnel) => {
    const newList = commandPersonnel.map(p => p.id === updatedPersonnel.id ? updatedPersonnel : p);
    updateAndSaveCommandPersonnel(newList);
  };
  
  const updateAndSaveServicePersonnel = (newList: Personnel[]) => {
    const sortedList = newList.sort(sortPersonnel);
    setServicePersonnel(sortedList);
    localStorage.setItem('servicePersonnel', JSON.stringify(sortedList));
  };
  
  const handleUpdateServicePersonnel = (updatedPersonnel: Personnel) => {
    const newList = servicePersonnel.map(p => p.id === updatedPersonnel.id ? updatedPersonnel : p);
    updateAndSaveServicePersonnel(newList);
  };


  const updateAndSaveUnits = (newList: string[]) => {
    setUnitList(newList);
    localStorage.setItem('unitList', JSON.stringify(newList));
  };

  const parseDateFromString = (dateString: string): Date | null => {
    const cleanedDateString = dateString.replace(/GUARDIA DEL DIA/i, '').replace('.-', '').trim();
    const monthNames: { [key: string]: number } = {
      "ENERO": 0, "FEBRERO": 1, "MARZO": 2, "ABRIL": 3, "MAYO": 4, "JUNIO": 5,
      "JULIO": 6, "AGOSTO": 7, "SEPTIEMBRE": 8, "OCTUBRE": 9, "NOVIEMBRE": 10, "DICIEMBRE": 11
    };
    
    const parts = cleanedDateString.split(/DE\s/i);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = monthNames[parts[1].toUpperCase().trim()];
      const year = parseInt(parts[2], 10);

      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return null;
  };

  const handleDateChange = (part: 'day' | 'month' | 'year', value: number) => {
    setDisplayDate(currentDate => {
        const newDate = currentDate ? new Date(currentDate.getTime()) : new Date();

        const originalDay = newDate.getDate();

        if (part === 'year') {
            newDate.setFullYear(value);
        }
        if (part === 'month') {
            newDate.setMonth(value);
        }

        // Adjust day if it's invalid for the new month/year
        const daysInNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
        if (originalDay > daysInNewMonth) {
            newDate.setDate(daysInNewMonth);
        }

        if (part === 'day') {
            newDate.setDate(value);
        }
        
        return newDate;
    });
  };
  
    const handleUpdateCommandStaff = (updatedStaff: Officer[], isAutoUpdate = false) => {
    if (!isAutoUpdate) {
        let personnelListWasUpdated = false;
        const newPersonnelList = [...commandPersonnel];

        updatedStaff.forEach(officer => {
            if (officer.id && officer.name && officer.rank) {
                const personnelIndex = newPersonnelList.findIndex(p => p.id === officer.id);
                if (personnelIndex !== -1) {
                    if (newPersonnelList[personnelIndex].rank !== officer.rank || newPersonnelList[personnelIndex].name !== officer.name) {
                        newPersonnelList[personnelIndex].rank = officer.rank;
                        newPersonnelList[personnelIndex].name = officer.name;
                        personnelListWasUpdated = true;
                    }
                } else if (officer.name !== 'A designar' && officer.name !== 'No Asignado') {
                  newPersonnelList.push({ id: officer.id, name: officer.name, rank: officer.rank });
                  personnelListWasUpdated = true;
                }
            }
        });

        if (personnelListWasUpdated) {
            updateAndSaveCommandPersonnel(newPersonnelList);
        }
    }
    
    setSchedule(prev => prev ? { ...prev, commandStaff: updatedStaff } : prev);
  };


  const loadGuardLineFromRoster = (dateToLoad: Date | null) => {
    if (!dateToLoad || !roster) return;

    const dateKey = `${dateToLoad.getFullYear()}-${String(dateToLoad.getMonth() + 1).padStart(2, '0')}-${String(dateToLoad.getDate()).padStart(2, '0')}`;
    const dayRoster = roster[dateKey];

    const rolesMap = [
        { key: 'jefeInspecciones', label: 'JEFE DE INSPECCIONES' },
        { key: 'jefeServicio', label: 'JEFE DE SERVICIO' },
        { key: 'jefeGuardia', label: 'JEFE DE GUARDIA' },
        { key: 'jefeReserva', label: 'JEFE DE RESERVA' }
    ];

    const finalStaff = rolesMap.map(roleInfo => {
       const personName = dayRoster?.[roleInfo.key as keyof typeof dayRoster];
       if (personName) {
           const foundPersonnel = commandPersonnel.find(p => p.name === personName);
           if (foundPersonnel) {
               return { role: roleInfo.label, name: foundPersonnel.name, id: foundPersonnel.id, rank: foundPersonnel.rank };
           }
           // Person from roster not found, create placeholder with the name from roster
           return { role: roleInfo.label, name: personName, rank: 'OTRO', id: `roster-${dateKey}-${roleInfo.key}` };
       }
       // If no one is assigned, create placeholder "A designar"
       return { role: roleInfo.label, name: "A designar", rank: 'OTRO', id: `empty-${roleInfo.key}` };
    });

    handleUpdateCommandStaff(finalStaff, true);
  };
  
    // Effect to perform the initial load of the guard line from the roster
    useEffect(() => {
        if (isInitialLoad.current && displayDate && commandPersonnel.length > 0 && roster) {
            loadGuardLineFromRoster(displayDate);
            isInitialLoad.current = false; // Prevent re-running on subsequent data changes
        }
    }, [displayDate, commandPersonnel, roster]);


  const handleUpdateService = (updatedService: Service, type: 'common' | 'sports') => {
    setSchedule(prev => {
      if (!prev) return prev;
      const key = type === 'common' ? 'services' : 'sportsEvents';
      const newServices = prev[key].map(s => s.id === updatedService.id ? updatedService : s);
      return { ...prev, [key]: newServices };
    });
  };

  const handleAddNewService = (type: 'common' | 'sports') => {
    setSchedule(prev => {
      if (!prev) return prev;
      const key = type === 'common' ? 'services' : 'sportsEvents';
      const newService: Service = {
        id: `new-service-${Date.now()}`,
        title: type === 'common' ? "Nuevo Servicio (Editar)" : "Nuevo Evento Deportivo (Editar)",
        description: "",
        assignments: [],
        novelty: "",
        isHidden: false
      };
      
      const list = prev[key];
      const firstHiddenIndex = list.findIndex(s => s.isHidden);
      const insertIndex = firstHiddenIndex === -1 ? list.length : firstHiddenIndex;
      
      const newServices = [...list];
      newServices.splice(insertIndex, 0, newService);

      return { ...prev, [key]: newServices };
    });
  };
  
  const handleMoveService = (serviceId: string, direction: 'up' | 'down', type: 'common' | 'sports') => {
      setSchedule(prev => {
        if (!prev) return prev;
        
        const key = type === 'common' ? 'services' : 'sportsEvents';
        const services = [...prev[key]];
        const currentIndex = services.findIndex(s => s.id === serviceId);

        if (currentIndex === -1) return prev;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        
        if (targetIndex < 0 || targetIndex >= services.length || services[targetIndex].isHidden) {
            return prev;
        }
        
        [services[currentIndex], services[targetIndex]] = [services[targetIndex], services[currentIndex]];
        
        return { ...prev, [key]: services };
      });
  };
  
  const handleToggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(serviceId)) {
            newSelection.delete(serviceId);
        } else {
            newSelection.add(serviceId);
        }
        return newSelection;
    });
  };

  const handleSelectAllServices = (selectAll: boolean) => {
    if (!schedule) return;
    
    const allServices = [...schedule.services, ...schedule.sportsEvents];
    const visibleServiceIds = allServices.filter(s => !s.isHidden).map(s => s.id);

    if (selectAll) {
        setSelectedServiceIds(new Set(visibleServiceIds));
    } else {
        const currentHiddenSelected = [...selectedServiceIds].filter(id => {
            const service = allServices.find(s => s.id === id);
            return service && service.isHidden;
        });
        setSelectedServiceIds(new Set(currentHiddenSelected));
    }
  };

  const handleToggleVisibilityForSelected = () => {
    if (selectedServiceIds.size === 0 || !schedule) return;

    const allServices = [...schedule.services, ...schedule.sportsEvents];
    const firstSelectedService = allServices.find(s => selectedServiceIds.has(s.id));
    if (!firstSelectedService) return;

    const newVisibility = !firstSelectedService.isHidden;

    const updateVisibility = (services: Service[]) => {
      return services.map(s => 
        selectedServiceIds.has(s.id) ? { ...s, isHidden: newVisibility } : s
      ).sort((a, b) => (a.isHidden ? 1 : 0) - (b.isHidden ? 1 : 0));
    };

    setSchedule(prev => {
      if (!prev) return prev;
      
      const newServices = updateVisibility(prev.services);
      const newSportsEvents = updateVisibility(prev.sportsEvents);

      setSelectedServiceIds(new Set());
      return { ...prev, services: newServices, sportsEvents: newSportsEvents };
    });
  };

  const handleResetData = () => {
    if (window.confirm("¿Estás seguro de que quieres reiniciar todos los datos? Se perderán todos los cambios guardados.")) {
      localStorage.removeItem('scheduleData');
      localStorage.removeItem('commandPersonnel');
      localStorage.removeItem('servicePersonnel');
      localStorage.removeItem('unitList');
      localStorage.removeItem('rosterData');
      localStorage.removeItem('serviceTemplates');
      setSchedule(initializeSchedule());
      updateAndSaveCommandPersonnel(defaultCommandPersonnel);
      updateAndSaveServicePersonnel(defaultServicePersonnel);
      updateAndSaveUnits(defaultUnits);
      updateAndSaveRoster(preloadedRosterData);
      setServiceTemplates(defaultServiceTemplates);
    }
  }

  const handleExport = () => {
    if (schedule && displayDate) {
      const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
      const formattedDate = `${displayDate.getDate()} DE ${monthNames[displayDate.getMonth()]} DE ${displayDate.getFullYear()}`;
      exportScheduleToWord({ ...schedule, date: formattedDate });
    }
  };

  const handleExportByTime = () => {
    if (schedule && displayDate) {
      const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
      const formattedDate = `${displayDate.getDate()} DE ${monthNames[displayDate.getMonth()]} DE ${displayDate.getFullYear()}`;
      exportScheduleByTimeToWord({ date: formattedDate, assignmentsByTime: assignmentsByTime });
    }
  };
  
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const importMode = prompt("Elige el modo de importación:\n\n1. Añadir (agrega los servicios al horario actual)\n2. Reemplazar (borra los servicios actuales y los reemplaza con los del archivo)\n\nEscribe '1' o '2'. Cualquier otra cosa cancelará la operación.");

    if (importMode !== '1' && importMode !== '2') {
        alert("Importación cancelada.");
        event.target.value = ''; // Reset file input
        return;
    }

    try {
        let newServices: Service[] = [];
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const fileBuffer = await file.arrayBuffer();

        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            const servicesMap = new Map<string, Service>();

            json.forEach((row: any) => {
                const serviceTitle = row['Título del Servicio']?.trim();
                if (!serviceTitle) return;

                if (!servicesMap.has(serviceTitle)) {
                    servicesMap.set(serviceTitle, {
                        id: `imported-excel-${Date.now()}-${servicesMap.size}`,
                        title: serviceTitle,
                        description: row['Descripción del Servicio'] || '',
                        novelty: row['Novedad del Servicio'] || '',
                        isHidden: false,
                        assignments: [],
                    });
                }

                const service = servicesMap.get(serviceTitle)!;

                const location = row['Ubicación de Asignación'];
                const time = row['Horario de Asignación'];
                const personnel = row['Personal de Asignación'];

                if (location && time && personnel) {
                    const allDetailsRaw = row['Detalles de Asignación'] ? String(row['Detalles de Asignación']).split(/;|\n/g).map(d => d.trim()).filter(d => d) : [];
    
                    const implementationTimeValue = allDetailsRaw.find(d => d.toUpperCase().startsWith('HORARIO DE IMPLANTACION'));
                    const otherDetails = allDetailsRaw.filter(d => !d.toUpperCase().startsWith('HORARIO DE IMPLANTACION'));
                    
                    service.assignments.push({
                        id: `imported-assign-${Date.now()}-${service.assignments.length}`,
                        location: String(location),
                        time: String(time),
                        personnel: String(personnel),
                        unit: row['Unidad de Asignación'] ? String(row['Unidad de Asignación']) : undefined,
                        implementationTime: implementationTimeValue,
                        details: otherDetails,
                    });
                }
            });
            newServices = Array.from(servicesMap.values());
        } else if (fileExtension === 'docx') {
             newServices = await parseServicesFromWord(fileBuffer);
        } else {
            alert("Formato de archivo no soportado. Por favor, sube un archivo Excel (.xlsx, .xls) o Word (.docx).");
            event.target.value = '';
            return;
        }

        if (newServices.length === 0) {
            alert("No se encontraron servicios válidos en el archivo. Asegúrate de que el archivo tiene el formato y los datos correctos.");
            return;
        }
        
        const importedSportsEvents = newServices.filter(s => s.title.toUpperCase().includes('EVENTO DEPORTIVO'));
        const importedCommonServices = newServices.filter(s => !s.title.toUpperCase().includes('EVENTO DEPORTIVO'));


        if (importMode === '1') { // Add
            setSchedule(prev => {
                if (!prev) return prev;
                const visibleServices = prev.services.filter(s => !s.isHidden);
                const hiddenServices = prev.services.filter(s => s.isHidden);
                const visibleSports = prev.sportsEvents.filter(s => !s.isHidden);
                const hiddenSports = prev.sportsEvents.filter(s => s.isHidden);
                return {
                    ...prev,
                    services: [...visibleServices, ...importedCommonServices, ...hiddenServices],
                    sportsEvents: [...visibleSports, ...importedSportsEvents, ...hiddenSports]
                };
            });
            alert(`${newServices.length} servicio(s) importado(s) y añadidos con éxito.`);
        } else { // Replace (mode '2')
            setSchedule(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    services: importedCommonServices,
                    sportsEvents: importedSportsEvents,
                };
            });
            alert(`El horario ha sido reemplazado. ${newServices.length} servicio(s) importado(s) con éxito.`);
        }

    } catch (error) {
        console.error("Error al importar el archivo:", error);
        alert("Hubo un error al procesar el archivo. Por favor, asegúrate de que es un archivo válido con el formato correcto.");
    } finally {
        event.target.value = ''; // Reset file input
    }
  };

  const handleRosterImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (window.confirm("¿Deseas fusionar los datos de este archivo con el rol de guardia actual? Las fechas existentes con los mismos datos serán sobreescritas.")) {
        try {
            const text = await file.text();
            const newRosterData = JSON.parse(text);

            if (typeof newRosterData !== 'object' || newRosterData === null || Array.isArray(newRosterData)) {
                throw new Error("El archivo JSON debe ser un objeto de fechas y personal asignado.");
            }

            updateAndSaveRoster({ ...roster, ...newRosterData });
            alert("Rol de guardia actualizado con éxito.");

        } catch (error) {
            console.error("Error al importar el rol de guardia:", error);
            alert("Hubo un error al procesar el archivo. Por favor, asegúrate de que es un archivo JSON válido con el formato correcto.");
        } finally {
            if(event.target) event.target.value = '';
        }
    } else {
        if(event.target) event.target.value = '';
    }
  };

  const handleConfirmRosterImport = () => {
    setIsRosterModalOpen(false);
    rosterInputRef.current?.click();
  };

  const handleSaveAsTemplate = (service: Service) => {
    const newTemplate: ServiceTemplate = {
      ...JSON.parse(JSON.stringify(service)),
      templateId: `template-${Date.now()}`
    };
    updateAndSaveTemplates([...serviceTemplates, newTemplate]);
    setToastMessage(`Servicio "${service.title}" guardado como plantilla.`);
  };

  const handleOpenTemplateModal = (mode: 'add' | 'replace', serviceType: 'common' | 'sports', serviceId?: string) => {
    setTemplateModalConfig({ mode, serviceType, serviceToReplaceId: serviceId });
    setIsTemplateModalOpen(true);
  };
  
  const handleSelectTemplate = (template: ServiceTemplate) => {
    const listKey = templateModalConfig.serviceType === 'common' ? 'services' : 'sportsEvents';

    if (templateModalConfig.mode === 'add') {
      const newService: Service = {
        ...JSON.parse(JSON.stringify(template)),
        id: `service-from-template-${Date.now()}`,
      };
      delete (newService as any).templateId;
      
      setSchedule(prev => {
        if (!prev) return prev;
        const list = prev[listKey];
        const firstHiddenIndex = list.findIndex(s => s.isHidden);
        const insertIndex = firstHiddenIndex === -1 ? list.length : firstHiddenIndex;
        const newList = [...list];
        newList.splice(insertIndex, 0, newService);
        return { ...prev, [listKey]: newList };
      });
      setToastMessage(`Servicio "${template.title}" añadido desde plantilla.`);

    } else if (templateModalConfig.mode === 'replace' && templateModalConfig.serviceToReplaceId) {
      setSchedule(prev => {
        if (!prev) return prev;
        const newList = prev[listKey].map(s => {
          if (s.id === templateModalConfig.serviceToReplaceId) {
            const updatedService = {
              ...JSON.parse(JSON.stringify(template)),
              id: s.id, // Keep original ID
            };
            delete (updatedService as any).templateId;
            return updatedService;
          }
          return s;
        });
        return { ...prev, [listKey]: newList };
      });
      setToastMessage(`Servicio reemplazado con plantilla "${template.title}".`);
    }
    setIsTemplateModalOpen(false);
  };

  const handleExportAsTemplate = (format: 'excel' | 'word') => {
    if (!schedule) return;
    if (format === 'excel') {
      exportScheduleAsExcelTemplate(schedule);
    } else {
      exportScheduleAsWordTemplate(schedule);
    }
    setIsExportTemplateModalOpen(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    updateAndSaveTemplates(serviceTemplates.filter(t => t.templateId !== templateId));
  };

  const handleAssignmentStatusChange = (assignmentId: string, statusUpdate: { inService?: boolean; serviceEnded?: boolean }) => {
    setSchedule(prev => {
        if (!prev) return prev;
        const allServices = [...prev.services, ...prev.sportsEvents];
        let serviceToUpdate: Service | undefined;
        let serviceType: 'common' | 'sports' | undefined;

        for (const service of prev.services) {
            if (service.assignments.some(a => a.id === assignmentId)) {
                serviceToUpdate = service;
                serviceType = 'common';
                break;
            }
        }
        if (!serviceToUpdate) {
            for (const service of prev.sportsEvents) {
                if (service.assignments.some(a => a.id === assignmentId)) {
                    serviceToUpdate = service;
                    serviceType = 'sports';
                    break;
                }
            }
        }

        if (!serviceToUpdate || !serviceType) return prev;
        
        const newAssignments = serviceToUpdate.assignments.map(a => {
            if (a.id === assignmentId) {
                const updatedAssignment = { ...a };
                if ('inService' in statusUpdate) updatedAssignment.inService = statusUpdate.inService;
                if ('serviceEnded' in statusUpdate) updatedAssignment.serviceEnded = statusUpdate.serviceEnded;
                
                if (updatedAssignment.serviceEnded) updatedAssignment.inService = true;
                if (updatedAssignment.inService === false) updatedAssignment.serviceEnded = false;
                
                return updatedAssignment;
            }
            return a;
        });
        
        const updatedService = { ...serviceToUpdate, assignments: newAssignments };
        const key = serviceType === 'common' ? 'services' : 'sportsEvents';
        const newServiceList = prev[key].map(s => s.id === updatedService.id ? updatedService : s);

        return { ...prev, [key]: newServiceList };
    });
  };

  const assignmentsByTime = useMemo(() => {
    if (!schedule) return {};
    const grouped: { [time: string]: Assignment[] } = {};
    const allServices = [...schedule.services, ...schedule.sportsEvents];
    allServices.filter(s => !s.isHidden).forEach(service => {
      service.assignments.forEach(assignment => {
        const timeKey = assignment.time;
        if (!grouped[timeKey]) {
          grouped[timeKey] = [];
        }
        grouped[timeKey].push({ ...assignment, serviceTitle: service.title, novelty: service.novelty });
      });
    });
    return grouped;
  }, [schedule]);

  const visibilityAction = useMemo(() => {
    if (!schedule || selectedServiceIds.size === 0) return { action: 'none', label: '' };
    const allServices = [...schedule.services, ...schedule.sportsEvents];
    const firstSelectedService = allServices.find(s => selectedServiceIds.has(s.id));
    if (firstSelectedService?.isHidden) {
      return { action: 'show', label: 'Mostrar Seleccionados' };
    }
    return { action: 'hide', label: 'Ocultar Seleccionados' };
  }, [selectedServiceIds, schedule]);

  const renderView = () => {
    if (!schedule) return null;

    switch (view) {
      case 'schedule':
        return <ScheduleDisplay
          schedule={schedule}
          displayDate={displayDate}
          selectedServiceIds={selectedServiceIds}
          onDateChange={handleDateChange}
          onUpdateService={handleUpdateService}
          onUpdateCommandStaff={handleUpdateCommandStaff}
          onAddNewService={handleAddNewService}
          onMoveService={handleMoveService}
          onToggleServiceSelection={handleToggleServiceSelection}
          onSelectAllServices={handleSelectAllServices}
          onSaveAsTemplate={handleSaveAsTemplate}
          onReplaceFromTemplate={(serviceId, type) => handleOpenTemplateModal('replace', type, serviceId)}
          onImportGuardLine={() => loadGuardLineFromRoster(displayDate)}
          commandPersonnel={commandPersonnel}
          servicePersonnel={servicePersonnel}
          unitList={unitList}
        />;
      case 'time-grouped':
        return <TimeGroupedScheduleDisplay 
          assignmentsByTime={assignmentsByTime}
          onAssignmentStatusChange={handleAssignmentStatusChange} 
        />;
      case 'nomenclador':
        return <Nomenclador
          commandPersonnel={commandPersonnel}
          onAddCommandPersonnel={(item) => updateAndSaveCommandPersonnel([...commandPersonnel, item])}
          onUpdateCommandPersonnel={handleUpdateCommandPersonnel}
          onRemoveCommandPersonnel={(item) => updateAndSaveCommandPersonnel(commandPersonnel.filter(p => p.id !== item.id))}
          servicePersonnel={servicePersonnel}
          onAddServicePersonnel={(item) => updateAndSaveServicePersonnel([...servicePersonnel, item])}
          onUpdateServicePersonnel={handleUpdateServicePersonnel}
          onRemoveServicePersonnel={(item) => updateAndSaveServicePersonnel(servicePersonnel.filter(p => p.id !== item.id))}
          units={unitList}
          onUpdateUnits={updateAndSaveUnits}
          roster={roster}
          onUpdateRoster={updateAndSaveRoster}
        />;
      default:
        return null;
    }
  };

  const getButtonClass = (buttonView: View) =>
    `flex items-center gap-2 px-4 py-2 rounded-md transition-colors font-medium ${view === buttonView
      ? 'bg-blue-600 text-white shadow-lg'
      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
    }`;


  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans">
      {toastMessage && (
        <div className="fixed top-24 right-8 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}
      <header className="bg-gray-800/80 backdrop-blur-sm sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between h-auto sm:h-20 py-4 sm:py-0">
            <div className="flex items-center mb-4 sm:mb-0">
               <button onClick={handleResetData} className="mr-2 text-gray-400 hover:text-white transition-colors" aria-label="Reiniciar Datos">
                  <RefreshIcon className="w-6 h-6"/>
               </button>
               <button onClick={() => setIsHelpModalOpen(true)} className="mr-4 text-gray-400 hover:text-white transition-colors" aria-label="Ayuda">
                  <QuestionMarkCircleIcon className="w-6 h-6"/>
               </button>
              <CalendarIcon className="w-10 h-10 text-blue-400 mr-3" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Servicios del Cuerpo de Bomberos de la Ciudad</h1>
                <p className="text-xs text-gray-400">Planificador de Guardia</p>
              </div>
            </div>
            {schedule && (
              <div className="flex flex-wrap items-center gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileImport} 
                    style={{ display: 'none' }} 
                    accept=".xlsx, .xls, .docx"
                />
                 <input 
                    type="file" 
                    ref={rosterInputRef} 
                    onChange={handleRosterImport} 
                    style={{ display: 'none' }} 
                    accept=".json"
                />
                <button onClick={() => setView('schedule')} className={getButtonClass('schedule')}><ClipboardListIcon className="w-5 h-5" />Vista General</button>
                <button onClick={() => setView('time-grouped')} className={getButtonClass('time-grouped')}><ClockIcon className="w-5 h-5" />Vista por Hora</button>
                <button onClick={() => setView('nomenclador')} className={getButtonClass('nomenclador')}><BookOpenIcon className="w-5 h-5" />Nomencladores</button>
                <button onClick={() => handleOpenTemplateModal('add', 'common')} className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"><BookmarkIcon className="w-5 h-5" />Añadir desde Plantilla</button>
                <button onClick={() => setIsRosterModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"><UploadIcon className="w-5 h-5" />Importar Rol</button>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"><UploadIcon className="w-5 h-5" />Importar Servicios</button>
                <button onClick={() => setIsExportTemplateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"><DownloadIcon className="w-5 h-5" />Exportar Plantilla</button>
                <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"><DownloadIcon className="w-5 h-5" />Exportar General</button>
                <button onClick={handleExportByTime} className="flex items-center gap-2 px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-500 text-white font-medium transition-colors"><DownloadIcon className="w-5 h-5" />Exportar por Hora</button>
                 {selectedServiceIds.size > 0 && view === 'schedule' && (
                  <button onClick={handleToggleVisibilityForSelected} className={`flex items-center gap-2 px-4 py-2 rounded-md text-white font-medium transition-colors animate-fade-in ${visibilityAction.action === 'hide' ? 'bg-red-600 hover:bg-red-500' : 'bg-purple-600 hover:bg-purple-500'}`}>
                    {visibilityAction.action === 'hide' ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    {visibilityAction.label} ({selectedServiceIds.size})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {!schedule && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {schedule && renderView()}

      </main>
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
        unitList={unitList}
      />
      <RosterImportModal 
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        onConfirm={handleConfirmRosterImport}
      />
      <ServiceTemplateModal 
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={serviceTemplates}
        onSelectTemplate={handleSelectTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />
      <ExportTemplateModal
        isOpen={isExportTemplateModalOpen}
        onClose={() => setIsExportTemplateModalOpen(false)}
        onExport={handleExportAsTemplate}
      />
    </div>
  );
};

export default App;