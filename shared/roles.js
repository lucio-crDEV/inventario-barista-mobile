export const roleNames = {
  admin: 'Administrador',
  service_lead: 'Jefa de servicio',
  worker: 'Trabajador',
};
export const managesUsers = (user) => ['admin', 'service_lead'].includes(user.role);
