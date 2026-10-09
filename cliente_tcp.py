import os
import socket
import json

# El servidor se indica por variables de entorno para no dejar IPs en el codigo:
#   PowerShell:  $env:TCP_HOST="<IP_EC2>"; python cliente_tcp.py
#   Linux/Mac:   TCP_HOST=<IP_EC2> python3 cliente_tcp.py
HOST = os.environ.get("TCP_HOST", "localhost")
PORT = int(os.environ.get("TCP_PORT", "6061"))


def enviar_mensaje(mensaje):
    try:
        cliente = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        cliente.connect((HOST, PORT))

        cliente.sendall(mensaje.encode("utf-8"))

        respuesta = cliente.recv(4096).decode("utf-8")
        cliente.close()

        return respuesta

    except ConnectionRefusedError:
        return "ERROR: No se pudo conectar al servidor TCP."

    except Exception as error:
        return f"ERROR: {error}"


while True:

    print("\n==============================")
    print("       CLIENTE TCP")
    print("==============================")
    print(f"Servidor: {HOST}:{PORT}")
    print("1. Insertar tarea")
    print("2. Obtener tarea")
    print("3. Salir")
    print("==============================")

    opcion = input("Selecciona una opcion: ")

    # INSERT
    if opcion == "1":

        print("\n--- INSERTAR TAREA ---")

        titulo = input("Titulo: ")
        categoria_id = input("ID de categoria (Enter para omitir): ")

        elemento = {"titulo": titulo}
        if categoria_id.strip() != "":
            elemento["categoria_id"] = int(categoria_id)

        mensaje = "{insert:" + json.dumps(elemento) + "}"

        print("\nMensaje enviado:")
        print(mensaje)

        respuesta = enviar_mensaje(mensaje)

        print("\nRespuesta del servidor:")
        print(respuesta)

    # GET
    elif opcion == "2":

        print("\n--- OBTENER TAREA ---")

        tarea_id = input("ID de la tarea (vacio para obtener todas): ")

        mensaje = "{get:" + tarea_id + "}"

        print("\nMensaje enviado:")
        print(mensaje)

        respuesta = enviar_mensaje(mensaje)

        print("\nRespuesta del servidor:")
        print(respuesta)

    # SALIR
    elif opcion == "3":

        print("\nCliente TCP cerrado.")
        break

    else:

        print("\nOpcion no valida.")
