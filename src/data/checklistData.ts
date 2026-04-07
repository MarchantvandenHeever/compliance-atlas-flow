import { ChecklistTemplate, ChecklistSection, ChecklistItem } from '@/types';

const eaSections: ChecklistSection[] = [
  { id: 'ea-general', templateId: 'tpl-1', name: 'General Conditions', source: 'EA', order: 1 },
  { id: 'ea-monitoring', templateId: 'tpl-1', name: 'Monitoring & Reporting Requirements', source: 'EA', order: 2 },
  { id: 'ea-empr', templateId: 'tpl-1', name: 'EMPr Conditions', source: 'EA', order: 3 },
];

const emprSections: ChecklistSection[] = [
  { id: 'empr-obj1', templateId: 'tpl-1', name: 'Objective 1: Site Establishment & Management', source: 'EMPr', order: 4 },
  { id: 'empr-obj2', templateId: 'tpl-1', name: 'Objective 2: Environmental Awareness', source: 'EMPr', order: 5 },
  { id: 'empr-obj3', templateId: 'tpl-1', name: 'Objective 3: Water Resource Protection', source: 'EMPr', order: 6 },
  { id: 'empr-obj4', templateId: 'tpl-1', name: 'Objective 4: Noise Management', source: 'EMPr', order: 7 },
  { id: 'empr-obj5', templateId: 'tpl-1', name: 'Objective 5: Hazardous Substances Management', source: 'EMPr', order: 8 },
  { id: 'empr-obj6', templateId: 'tpl-1', name: 'Objective 6: Air Quality & Dust Control', source: 'EMPr', order: 9 },
  { id: 'empr-obj7', templateId: 'tpl-1', name: 'Objective 7: Soil Degradation & Erosion Control', source: 'EMPr', order: 10 },
  { id: 'empr-obj8', templateId: 'tpl-1', name: 'Objective 8: Vegetation & Faunal Habitat Protection', source: 'EMPr', order: 11 },
  { id: 'empr-obj9', templateId: 'tpl-1', name: 'Objective 9: Wetlands & Watercourse Protection', source: 'EMPr', order: 12 },
  { id: 'empr-obj10', templateId: 'tpl-1', name: 'Objective 10: Alien Invasive Plant Control', source: 'EMPr', order: 13 },
  { id: 'empr-obj11', templateId: 'tpl-1', name: 'Objective 11: Heritage Resource Protection', source: 'EMPr', order: 14 },
  { id: 'empr-obj12', templateId: 'tpl-1', name: 'Objective 12: Visual Impact Minimisation', source: 'EMPr', order: 15 },
  { id: 'empr-obj13', templateId: 'tpl-1', name: 'Objective 13: Avifauna Protection', source: 'EMPr', order: 16 },
  { id: 'empr-obj14', templateId: 'tpl-1', name: 'Objective 14: Waste Management', source: 'EMPr', order: 17 },
];

const eaItems: ChecklistItem[] = [
  { id: 'ea-1', sectionId: 'ea-general', conditionRef: '1', description: 'Authorisation of the activity is subject to the conditions contained in this environmental authorisation, which form part of the environmental authorisation and are binding on the holder of the authorisation.', source: 'EA', order: 1 },
  { id: 'ea-2', sectionId: 'ea-general', conditionRef: '2', description: 'The holder of the authorisation is responsible for ensuring compliance with the conditions contained in this environmental authorisation, including any person acting on the holder\'s behalf.', source: 'EA', order: 2 },
  { id: 'ea-3', sectionId: 'ea-general', conditionRef: '3', description: 'The activities authorised may only be carried out at the property as described above.', source: 'EA', order: 3 },
  { id: 'ea-4', sectionId: 'ea-general', conditionRef: '4', description: 'Any changes to, or deviations from, the project description set out in this environmental authorisation must be approved, in writing, by the Department before such changes or deviations may be effected.', source: 'EA', order: 4 },
  { id: 'ea-5', sectionId: 'ea-general', conditionRef: '5', description: 'The holder of an environmental authorisation must apply for an amendment of the environmental authorisation with the competent authority for any alteration, transfer or change of ownership rights in the property.', source: 'EA', order: 5 },
  { id: 'ea-6', sectionId: 'ea-general', conditionRef: '6', description: 'This activity must commence within a period of five (5) years from the date of issue of this environmental authorisation.', source: 'EA', order: 6 },
  { id: 'ea-7', sectionId: 'ea-general', conditionRef: '7', description: 'Commencement with one activity listed in terms of this environmental authorisation constitutes commencement of all authorised activities.', source: 'EA', order: 7 },
  { id: 'ea-8', sectionId: 'ea-general', conditionRef: '8', description: 'The holder of the authorisation must notify every registered interested and affected party, in writing and within 14 calendar days of the date of this environmental authorisation.', source: 'EA', order: 8 },
  { id: 'ea-9', sectionId: 'ea-general', conditionRef: '10.1', description: 'The notification must specify the date on which the authorisation was issued.', source: 'EA', order: 9 },
  { id: 'ea-10', sectionId: 'ea-general', conditionRef: '10.2', description: 'The notification must inform the interested and affected party of the appeal procedure provided for in the National Appeal Regulations, 2014.', source: 'EA', order: 10 },
  { id: 'ea-11', sectionId: 'ea-general', conditionRef: '10.3', description: 'The notification must advise the interested and affected party that a copy of the authorisation will be furnished on request.', source: 'EA', order: 11 },
  { id: 'ea-12', sectionId: 'ea-general', conditionRef: '10.4', description: 'The notification must give the reasons of the competent authority for the decision.', source: 'EA', order: 12 },
  { id: 'ea-13', sectionId: 'ea-general', conditionRef: '14', description: 'The authorised activity shall not commence until the period for the submission of appeals has lapsed.', source: 'EA', order: 13 },
  { id: 'ea-14', sectionId: 'ea-general', conditionRef: '15', description: 'The Environmental Management Programme (EMPr) submitted as part of the Application for Environmental Authorisation is hereby approved.', source: 'EA', order: 14 },
  { id: 'ea-15', sectionId: 'ea-monitoring', conditionRef: '20', description: 'The holder of the authorisation must appoint an experienced independent Environmental Control Officer (ECO) for the construction phase.', source: 'EA', order: 15 },
  { id: 'ea-16', sectionId: 'ea-monitoring', conditionRef: '21', description: 'The ECO must be appointed before commencement of any authorised activities.', source: 'EA', order: 16 },
  { id: 'ea-17', sectionId: 'ea-monitoring', conditionRef: '22', description: 'Once appointed, the name and contact details of the ECO must be submitted to the Director: Compliance Monitoring of the Department.', source: 'EA', order: 17 },
  { id: 'ea-18', sectionId: 'ea-monitoring', conditionRef: '23', description: 'The ECO must keep record of all activities on site, problems identified, transgressions noted, and a task schedule of tasks undertaken by the ECO.', source: 'EA', order: 18 },
  { id: 'ea-19', sectionId: 'ea-monitoring', conditionRef: '24', description: 'The ECO must remain employed until all rehabilitation measures are completed and the site is ready for operation.', source: 'EA', order: 19 },
  { id: 'ea-20', sectionId: 'ea-monitoring', conditionRef: '26', description: 'The holder of the environmental authorisation must ensure that project compliance with the conditions of the EA and EMPr are audited, and audit reports submitted to the Director: Compliance Monitoring.', source: 'EA', order: 20 },
];

const emprItems: ChecklistItem[] = [
  // Objective 1: Site Establishment
  { id: 'empr-1', sectionId: 'empr-obj1', conditionRef: '1', description: 'The contractor must establish a site camp in an area approved by the ECO and/or Environmental Officer (EO).', source: 'EMPr', order: 1 },
  { id: 'empr-2', sectionId: 'empr-obj1', conditionRef: '2', description: 'The site camp must include adequate ablution facilities for the number of workers on site.', source: 'EMPr', order: 2 },
  { id: 'empr-3', sectionId: 'empr-obj1', conditionRef: '3', description: 'Chemical toilets must be provided at the ratio of 1 toilet per 15 workers and must be serviced at least once a week.', source: 'EMPr', order: 3 },
  { id: 'empr-4', sectionId: 'empr-obj1', conditionRef: '4', description: 'Eating areas must be designated and equipped with weather protection and litter bins.', source: 'EMPr', order: 4 },
  { id: 'empr-5', sectionId: 'empr-obj1', conditionRef: '5', description: 'An adequate supply of potable water must be available on site.', source: 'EMPr', order: 5 },
  { id: 'empr-6', sectionId: 'empr-obj1', conditionRef: '6', description: 'The construction site must be kept neat and tidy at all times.', source: 'EMPr', order: 6 },
  { id: 'empr-7', sectionId: 'empr-obj1', conditionRef: '7', description: 'Secure site, working areas and excavations in an appropriate manner, as agreed with the Site Manager and EO.', source: 'EMPr', order: 7 },
  { id: 'empr-8', sectionId: 'empr-obj1', conditionRef: '8', description: 'Where necessary, control access, fence, and secure the area.', source: 'EMPr', order: 8 },
  // Objective 2: Environmental Awareness
  { id: 'empr-9', sectionId: 'empr-obj2', conditionRef: '9', description: 'All construction workers must undergo an environmental awareness induction training before being allowed to work on site.', source: 'EMPr', order: 9 },
  { id: 'empr-10', sectionId: 'empr-obj2', conditionRef: '10', description: 'Records of environmental awareness training must be kept on site for inspection.', source: 'EMPr', order: 10 },
  { id: 'empr-11', sectionId: 'empr-obj2', conditionRef: '11', description: 'Workers must be informed of the potential impacts of their activities on the environment.', source: 'EMPr', order: 11 },
  { id: 'empr-12', sectionId: 'empr-obj2', conditionRef: '12', description: 'Toolbox talks must be conducted regularly to address environmental issues.', source: 'EMPr', order: 12 },
  // Objective 3: Water
  { id: 'empr-13', sectionId: 'empr-obj3', conditionRef: '13', description: 'All reasonable measures must be taken to prevent the contamination of water resources.', source: 'EMPr', order: 13 },
  { id: 'empr-14', sectionId: 'empr-obj3', conditionRef: '14', description: 'Stormwater management measures must be implemented to prevent erosion and sedimentation of water resources.', source: 'EMPr', order: 14 },
  { id: 'empr-15', sectionId: 'empr-obj3', conditionRef: '15', description: 'No construction activity, including stockpiling, may occur within a watercourse or within 32m of a watercourse without prior authorisation.', source: 'EMPr', order: 15 },
  { id: 'empr-16', sectionId: 'empr-obj3', conditionRef: '16', description: 'Cement mixing and wash-out areas must be designated and contained to prevent contamination.', source: 'EMPr', order: 16 },
  { id: 'empr-17', sectionId: 'empr-obj3', conditionRef: '17', description: 'Wastewater from construction activities must not be discharged into any water resource.', source: 'EMPr', order: 17 },
  // Objective 4: Noise
  { id: 'empr-18', sectionId: 'empr-obj4', conditionRef: '18', description: 'Noise generating activities must be restricted to normal working hours (07:00 - 17:00) on weekdays.', source: 'EMPr', order: 18 },
  { id: 'empr-19', sectionId: 'empr-obj4', conditionRef: '19', description: 'All construction vehicles and equipment must be fitted with standard silencing devices.', source: 'EMPr', order: 19 },
  { id: 'empr-20', sectionId: 'empr-obj4', conditionRef: '20', description: 'Workers in noisy areas must be provided with suitable hearing protection.', source: 'EMPr', order: 20 },
  // Objective 5: Hazardous Substances
  { id: 'empr-21', sectionId: 'empr-obj5', conditionRef: '21', description: 'All hazardous substances must be stored in designated areas which are appropriately bunded with 110% containment capacity.', source: 'EMPr', order: 21 },
  { id: 'empr-22', sectionId: 'empr-obj5', conditionRef: '22', description: 'Material Safety Data Sheets (MSDS) must be available on site for all hazardous substances.', source: 'EMPr', order: 22 },
  { id: 'empr-23', sectionId: 'empr-obj5', conditionRef: '23', description: 'Spill containment and clean-up equipment must be available on site at all times.', source: 'EMPr', order: 23 },
  { id: 'empr-24', sectionId: 'empr-obj5', conditionRef: '24', description: 'Any spills must receive the necessary clean-up action. Bioremediation kits are to be kept on-site.', source: 'EMPr', order: 24 },
  { id: 'empr-25', sectionId: 'empr-obj5', conditionRef: '25', description: 'No refuelling of vehicles or equipment may occur within 50m of any water resource.', source: 'EMPr', order: 25 },
  { id: 'empr-26', sectionId: 'empr-obj5', conditionRef: '26', description: 'Drip trays must be placed under all stationary vehicles and equipment to contain potential oil/fuel leaks.', source: 'EMPr', order: 26 },
  // Objective 6: Air Quality
  { id: 'empr-27', sectionId: 'empr-obj6', conditionRef: '27', description: 'Appropriate dust suppressant must be applied on all exposed areas and stockpiles as required to minimise airborne dust.', source: 'EMPr', order: 27 },
  { id: 'empr-28', sectionId: 'empr-obj6', conditionRef: '28', description: 'Haul vehicles moving outside the construction site carrying material that can be wind-blown must be covered with tarpaulins.', source: 'EMPr', order: 28 },
  { id: 'empr-29', sectionId: 'empr-obj6', conditionRef: '29', description: 'A speed limit of 30km/h should be implemented for vehicles travelling on site to minimise dust generation.', source: 'EMPr', order: 29 },
  { id: 'empr-30', sectionId: 'empr-obj6', conditionRef: '30', description: 'Dust-generating activities may need to be rescheduled during periods of high winds if excessive dust is blowing towards nearby residences.', source: 'EMPr', order: 30 },
  { id: 'empr-31', sectionId: 'empr-obj6', conditionRef: '31', description: 'Disturbed areas must be re-vegetated as soon as practicable in line with the progression of construction activities.', source: 'EMPr', order: 31 },
  { id: 'empr-32', sectionId: 'empr-obj6', conditionRef: '32', description: 'Vehicles and equipment must be always maintained in a road-worthy condition.', source: 'EMPr', order: 32 },
  // Objective 7: Soil
  { id: 'empr-33', sectionId: 'empr-obj7', conditionRef: '33', description: 'Areas to be cleared must be clearly marked on-site to eliminate the potential for unnecessary clearing.', source: 'EMPr', order: 33 },
  { id: 'empr-34', sectionId: 'empr-obj7', conditionRef: '34', description: 'Practical phased development and vegetation clearing should be practiced so cleared areas are not left vulnerable to erosion.', source: 'EMPr', order: 34 },
  { id: 'empr-35', sectionId: 'empr-obj7', conditionRef: '35', description: 'Stockpiled topsoil should be covered to prevent erosion if deemed necessary by the EO.', source: 'EMPr', order: 35 },
  { id: 'empr-36', sectionId: 'empr-obj7', conditionRef: '36', description: 'Erosion control measures should be implemented in areas where soil has been disturbed due to construction activities.', source: 'EMPr', order: 36 },
  { id: 'empr-37', sectionId: 'empr-obj7', conditionRef: '37', description: 'No activities must take place outside of demarcated construction site.', source: 'EMPr', order: 37 },
  { id: 'empr-38', sectionId: 'empr-obj7', conditionRef: '38', description: 'All bare areas should be revegetated as soon as possible with locally occurring species.', source: 'EMPr', order: 38 },
  { id: 'empr-39', sectionId: 'empr-obj7', conditionRef: '39', description: 'Topsoil should be removed and stored separately and should be reapplied where appropriate.', source: 'EMPr', order: 39 },
  { id: 'empr-40', sectionId: 'empr-obj7', conditionRef: '40', description: 'Any fill material required must be sourced from a commercial off-site suitable/permitted source.', source: 'EMPr', order: 40 },
  { id: 'empr-41', sectionId: 'empr-obj7', conditionRef: '41', description: 'Excavated topsoil must be stockpiled in designated areas separate from base material at a maximum height of 2m.', source: 'EMPr', order: 41 },
  { id: 'empr-42', sectionId: 'empr-obj7', conditionRef: '42', description: 'Rehabilitate disturbed areas as soon as practicable when construction in an area is complete.', source: 'EMPr', order: 42 },
  // Objective 8: Vegetation & Fauna
  { id: 'empr-43', sectionId: 'empr-obj8', conditionRef: '43', description: 'Areas to be cleared must be clearly marked in the field to eliminate unnecessary clearing.', source: 'EMPr', order: 43 },
  { id: 'empr-44', sectionId: 'empr-obj8', conditionRef: '44', description: 'Any individuals of protected species observed within the development footprint during construction should be translocated under the supervision of the ECO.', source: 'EMPr', order: 44 },
  { id: 'empr-45', sectionId: 'empr-obj8', conditionRef: '45', description: 'Any fauna directly threatened by the construction activities should be removed to a safe location by the ECO.', source: 'EMPr', order: 45 },
  { id: 'empr-46', sectionId: 'empr-obj8', conditionRef: '46', description: 'Protected plants identified within the development footprint must not be disturbed or removed prior to a relevant permit being granted.', source: 'EMPr', order: 46 },
  { id: 'empr-47', sectionId: 'empr-obj8', conditionRef: '47', description: 'Staff/employees must be educated to keep construction activities within the demarcated areas.', source: 'EMPr', order: 47 },
  { id: 'empr-48', sectionId: 'empr-obj8', conditionRef: '48', description: 'A site rehabilitation programme must be developed and implemented as soon as possible once construction is completed.', source: 'EMPr', order: 48 },
  { id: 'empr-49', sectionId: 'empr-obj8', conditionRef: '49', description: 'The collection, hunting or harvesting of any plants or animals at the site must be strictly forbidden.', source: 'EMPr', order: 49 },
  // Objective 9: Wetlands
  { id: 'empr-50', sectionId: 'empr-obj9', conditionRef: '50', description: 'No vehicles to refuel within watercourses or wetland areas.', source: 'EMPr', order: 50 },
  { id: 'empr-51', sectionId: 'empr-obj9', conditionRef: '51', description: 'Strict use and management of all hazardous materials used on site must be implemented.', source: 'EMPr', order: 51 },
  { id: 'empr-52', sectionId: 'empr-obj9', conditionRef: '52', description: 'Containment of all contaminated water by means of careful run-off management must be ensured.', source: 'EMPr', order: 52 },
  { id: 'empr-53', sectionId: 'empr-obj9', conditionRef: '53', description: 'Any areas disturbed during the construction phase should be encouraged to rehabilitate as quickly and effectively as possible.', source: 'EMPr', order: 53 },
  { id: 'empr-54', sectionId: 'empr-obj9', conditionRef: '54', description: 'Silt traps should be used where there is a danger of topsoil or material stockpiles eroding and entering streams.', source: 'EMPr', order: 54 },
  // Objective 10: Alien Plants
  { id: 'empr-55', sectionId: 'empr-obj10', conditionRef: '55', description: 'Avoid creating conditions in which alien plants may become established. Keep disturbance of vegetation to a minimum.', source: 'EMPr', order: 55 },
  { id: 'empr-56', sectionId: 'empr-obj10', conditionRef: '56', description: 'When alien plants are detected, these should be controlled and cleared using the recommended control measures for each species.', source: 'EMPr', order: 56 },
  { id: 'empr-57', sectionId: 'empr-obj10', conditionRef: '57', description: 'No planting or importing any listed invasive alien plant species to the site for any purpose.', source: 'EMPr', order: 57 },
  { id: 'empr-58', sectionId: 'empr-obj10', conditionRef: '58', description: 'On-going alien plant monitoring and removal should be undertaken in all areas of the development site on an annual basis.', source: 'EMPr', order: 58 },
  // Objective 11: Heritage
  { id: 'empr-59', sectionId: 'empr-obj11', conditionRef: '59', description: 'In the event that fossil material does exist within the study area, any negative impact could be mitigated by recording and sampling by a professional paleontologist.', source: 'EMPr', order: 59 },
  { id: 'empr-60', sectionId: 'empr-obj11', conditionRef: '60', description: 'Construction managers should familiarize themselves on the possible types of heritage sites and cultural material they may encounter.', source: 'EMPr', order: 60 },
  { id: 'empr-61', sectionId: 'empr-obj11', conditionRef: '61', description: 'Should fossil remains be discovered during any phase of the construction, the ECO must be alerted and SAHRA informed.', source: 'EMPr', order: 61 },
  // Objective 12: Visual
  { id: 'empr-62', sectionId: 'empr-obj12', conditionRef: '62', description: 'Ensure that vegetation is not unnecessarily removed during the construction period.', source: 'EMPr', order: 62 },
  { id: 'empr-63', sectionId: 'empr-obj12', conditionRef: '63', description: 'Retain / re-establish and maintain natural vegetation in all areas outside of the development footprint.', source: 'EMPr', order: 63 },
  { id: 'empr-64', sectionId: 'empr-obj12', conditionRef: '64', description: 'Reduce and control construction dust using approved dust suppression techniques.', source: 'EMPr', order: 64 },
  { id: 'empr-65', sectionId: 'empr-obj12', conditionRef: '65', description: 'Rehabilitate construction disturbance as soon as possible after construction in an area is completed.', source: 'EMPr', order: 65 },
  { id: 'empr-66', sectionId: 'empr-obj12', conditionRef: '66', description: 'Restrict construction activities in close proximity to sensitive receptors to daylight hours whenever possible.', source: 'EMPr', order: 66 },
  // Objective 13: Avifauna
  { id: 'empr-67', sectionId: 'empr-obj13', conditionRef: '67', description: 'The temporal and spatial footprint of the development should be kept to a minimum.', source: 'EMPr', order: 67 },
  { id: 'empr-68', sectionId: 'empr-obj13', conditionRef: '68', description: 'Provide adequate briefing for site personnel on the possible important (Red Data) species occurring in the area.', source: 'EMPr', order: 68 },
  { id: 'empr-69', sectionId: 'empr-obj13', conditionRef: '69', description: 'To reduce collision and electrocution of birds on the power line, insulating electrical components and bird flight diverters must be installed.', source: 'EMPr', order: 69 },
  { id: 'empr-70', sectionId: 'empr-obj13', conditionRef: '70', description: 'Contractors and working staff should remain within the development footprint; movement outside into avian micro-habitats must be restricted.', source: 'EMPr', order: 70 },
  // Objective 14: Waste
  { id: 'empr-71', sectionId: 'empr-obj14', conditionRef: '71', description: 'The storage of flammable and combustible liquids must be in designated areas which are appropriately bunded and stored in compliance with MSDS files.', source: 'EMPr', order: 71 },
  { id: 'empr-72', sectionId: 'empr-obj14', conditionRef: '72', description: 'Any spills must receive the necessary clean-up action. Bioremediation kits are to be kept on-site.', source: 'EMPr', order: 72 },
  { id: 'empr-73', sectionId: 'empr-obj14', conditionRef: '73', description: 'Any storage and disposal permit/approvals which may be required must be obtained.', source: 'EMPr', order: 73 },
  { id: 'empr-74', sectionId: 'empr-obj14', conditionRef: '74', description: 'All waste must be disposed of at a suitably licensed waste disposal facility.', source: 'EMPr', order: 74 },
  { id: 'empr-75', sectionId: 'empr-obj14', conditionRef: '75', description: 'Separate waste bins/skips must be provided for general waste and hazardous waste and must be clearly marked.', source: 'EMPr', order: 75 },
  { id: 'empr-76', sectionId: 'empr-obj14', conditionRef: '76', description: 'Burning of waste on site is not permitted under any circumstances.', source: 'EMPr', order: 76 },
  { id: 'empr-77', sectionId: 'empr-obj14', conditionRef: '77', description: 'Waste records (safe disposal certificates) must be kept on site and made available for inspection.', source: 'EMPr', order: 77 },
  { id: 'empr-78', sectionId: 'empr-obj14', conditionRef: '78', description: 'Recycling of waste must be promoted where feasible.', source: 'EMPr', order: 78 },
];

export const defaultTemplate: ChecklistTemplate = {
  id: 'tpl-1',
  name: 'Zonnebloem 132kV EA & EMPr Checklist',
  version: 1,
  createdAt: '2025-11-01',
  isActive: true,
  sections: [...eaSections, ...emprSections],
  items: [...eaItems, ...emprItems],
};

// Sample audit data for demo
export const sampleAuditData = {
  project: {
    id: 'proj-1',
    name: 'Zonnebloem 132kV Switching Station',
    client: 'Eskom Holdings SOC Ltd',
    location: 'Steve Tshwete Local Municipality, Mpumalanga Province',
    auditFrequency: 'Monthly',
    status: 'active' as const,
    templateId: 'tpl-1',
    description: 'Construction of two 132kV Chickadee lines and new Zonnebloem Switching Station. DFFE Reference: 14/12/16/3/3/1/1908.',
  },
  monthlyTrend: [
    { month: 'Nov 2025', compliance: 95, compliant: 76, nonCompliant: 4, noted: 18 },
    { month: 'Dec 2025', compliance: 97, compliant: 78, nonCompliant: 2, noted: 18 },
    { month: 'Jan 2026', compliance: 98, compliant: 79, nonCompliant: 1, noted: 18 },
    { month: 'Feb 2026', compliance: 99, compliant: 80, nonCompliant: 1, noted: 17 },
    { month: 'Mar 2026', compliance: 100, compliant: 80, nonCompliant: 0, noted: 18 },
  ],
};
